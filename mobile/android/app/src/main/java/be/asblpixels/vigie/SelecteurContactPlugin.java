package be.asblpixels.vigie;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Laisse l'utilisateur choisir UN contact dans son propre répertoire.
 * Vigie n'a pas la permission de lire le répertoire : le sélecteur d'Android ne transmet que le contact
 * choisi, par une autorisation temporaire. Le numéro reste ensuite sur le téléphone.
 */
@CapacitorPlugin(name = "SelecteurContact")
public class SelecteurContactPlugin extends Plugin {

    @PluginMethod
    public void choisir(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, intent, "apresChoix");
    }

    @ActivityCallback
    private void apresChoix(PluginCall call, ActivityResult resultat) {
        if (call == null) {
            return;
        }
        if (resultat.getResultCode() != Activity.RESULT_OK || resultat.getData() == null) {
            call.reject("annule");
            return;
        }
        Uri uri = resultat.getData().getData();
        String[] colonnes = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        };
        try (Cursor c = getContext().getContentResolver().query(uri, colonnes, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                JSObject sortie = new JSObject();
                sortie.put("nom", c.getString(0));
                sortie.put("tel", c.getString(1));
                call.resolve(sortie);
                return;
            }
        } catch (Exception e) {
            call.reject("lecture impossible");
            return;
        }
        call.reject("introuvable");
    }
}
