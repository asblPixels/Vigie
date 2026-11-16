package be.asblpixels.vigie;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Lecture de texte sur la photo, entièrement sur le téléphone (ML Kit, modèle embarqué dans l'application).
 * Aucune donnée n'est envoyée sur Internet. Environ 0,3 s pour une capture d'écran.
 */
@CapacitorPlugin(name = "LectureTexte")
public class LectureTextePlugin extends Plugin {
    private TextRecognizer lecteur;

    @PluginMethod
    public void lire(final PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) { call.reject("image absente"); return; }
        try {
            byte[] octets = Base64.decode(data, Base64.DEFAULT);
            Bitmap image = BitmapFactory.decodeByteArray(octets, 0, octets.length);
            if (image == null) { call.reject("image illisible"); return; }
            if (lecteur == null) lecteur = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            lecteur.process(InputImage.fromBitmap(image, 0))
                .addOnSuccessListener(r -> {
                    JSObject o = new JSObject();
                    o.put("texte", r.getText());
                    call.resolve(o);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage() == null ? "echec" : e.getMessage()));
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "echec" : e.getMessage());
        }
    }
}
