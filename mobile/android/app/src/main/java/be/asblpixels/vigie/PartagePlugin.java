package be.asblpixels.vigie;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Contenu reçu par le bouton « Partager » d'Android (ACTION_SEND) : texte ou image.
 * C'est le geste que les gens connaissent déjà : un SMS douteux, « Partager », « Vérifier avec Vigie ».
 *
 * Rien ne quitte le téléphone : le contenu est simplement remis à l'interface web, qui l'analyse sur place.
 * Aucune autorisation n'est nécessaire : le droit de lire l'image est accordé par l'intention elle-même.
 *
 * MainActivity est en launchMode="singleTask" : elle appelle recevoir() à l'ouverture (onCreate) et
 * quand l'application tourne déjà (onNewIntent). Le contenu est gardé de côté puis récupéré une seule
 * fois par l'interface web ; l'événement « partage » n'est qu'un signal, le contenu vient toujours de
 * contenuEnAttente(), ce qui évite d'analyser deux fois le même message.
 */
@CapacitorPlugin(name = "Partage")
public class PartagePlugin extends Plugin {
    /** 12 Mio : une capture d'écran pèse moins de 2 Mio. Au-delà, on refuse plutôt que de saturer la mémoire. */
    private static final int TAILLE_MAX = 12 * 1024 * 1024;

    /* Déposé par le fil principal (recevoir), relu par le fil des appels du pont : volatile. */
    /** « texte », « image », « erreur », ou null quand il n'y a rien en attente. */
    private static volatile String typeEnAttente;
    private static volatile String texteEnAttente;
    private static volatile Uri imageEnAttente;
    /** Instance en vie, pour prévenir l'interface web quand l'application tourne déjà. */
    private static volatile PartagePlugin vivant;

    /** Appelé par MainActivity. Garde de côté ce qui vient d'être partagé, puis prévient l'interface web. */
    static void recevoir(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType() == null ? "" : intent.getType();
        Uri image = type.startsWith("image/") ? premiereImage(intent) : null;
        if (image != null) {
            typeEnAttente = "image"; imageEnAttente = image; texteEnAttente = null;
        } else {
            String texte = texteDe(intent);
            typeEnAttente = texte == null ? "erreur" : "texte";
            texteEnAttente = texte; imageEnAttente = null;
        }
        PartagePlugin p = vivant;
        if (p != null) p.notifyListeners("partage", new JSObject());
    }

    /** Texte partagé. Un courriel arrive souvent en deux morceaux, et l'objet porte souvent l'appât. */
    private static String texteDe(Intent intent) {
        CharSequence corps = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        CharSequence objet = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        String t = corps == null ? "" : corps.toString().trim();
        String o = objet == null ? "" : objet.toString().trim();
        if (!o.isEmpty() && !t.contains(o)) t = t.isEmpty() ? o : o + "\n\n" + t;
        return t.isEmpty() ? null : t;
    }

    /** Image partagée : EXTRA_STREAM, sinon le presse-papiers de l'intention. */
    @SuppressWarnings("deprecation")   // getParcelableExtra(String, Class) demande l'API 33, minSdk vaut 24
    private static Uri premiereImage(Intent intent) {
        Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (u != null) return u;
        ClipData presse = intent.getClipData();
        if (presse != null && presse.getItemCount() > 0) return presse.getItemAt(0).getUri();
        return null;
    }

    @Override
    public void load() {
        vivant = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (vivant == this) vivant = null;
    }

    /**
     * Rend ce qui est en attente, et le retire (on n'analyse qu'une fois).
     * Réponses : {type:""} rien, {type:"texte", texte}, {type:"image", image (base64), mime},
     * {type:"trop-grande"} ou {type:"erreur"}.
     */
    @PluginMethod
    public void contenuEnAttente(final PluginCall call) {
        String type = typeEnAttente;
        String texte = texteEnAttente;
        Uri image = imageEnAttente;
        typeEnAttente = null; texteEnAttente = null; imageEnAttente = null;

        JSObject o = new JSObject();
        if (type == null) { o.put("type", ""); call.resolve(o); return; }
        if ("texte".equals(type)) { o.put("type", "texte"); o.put("texte", texte); call.resolve(o); return; }
        if (!"image".equals(type)) { o.put("type", "erreur"); call.resolve(o); return; }
        try {
            // Le droit de lecture accordé par l'intention vaut tant que l'activité vit : la lecture
            // différée d'une seconde ou deux ne pose pas de problème, et elle se fait hors de onCreate.
            ContentResolver resolveur = getContext().getContentResolver();
            byte[] octets = octetsDe(resolveur, image);
            if (octets == null) { o.put("type", "trop-grande"); call.resolve(o); return; }
            String mime = resolveur.getType(image);
            o.put("type", "image");
            o.put("image", Base64.encodeToString(octets, Base64.NO_WRAP));
            o.put("mime", mime == null ? "image/jpeg" : mime);
        } catch (Exception | OutOfMemoryError e) {
            // Mieux vaut un message clair qu'un arrêt brutal : le public de Vigie ne saurait pas quoi en faire.
            o = new JSObject();
            o.put("type", "erreur");
        }
        call.resolve(o);
    }

    /** Octets de l'image, ou null si elle dépasse TAILLE_MAX (on abandonne sans tout charger). */
    private static byte[] octetsDe(ContentResolver resolveur, Uri uri) throws Exception {
        InputStream flux = resolveur.openInputStream(uri);
        if (flux == null) throw new Exception("image illisible");
        try {
            ByteArrayOutputStream tampon = new ByteArrayOutputStream();
            byte[] bloc = new byte[65536];
            int lu, total = 0;
            while ((lu = flux.read(bloc)) != -1) {
                total += lu;
                if (total > TAILLE_MAX) return null;
                tampon.write(bloc, 0, lu);
            }
            return tampon.toByteArray();
        } finally {
            flux.close();
        }
    }
}
