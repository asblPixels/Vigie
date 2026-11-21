package be.asblpixels.vigie;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PartagePlugin.class);
        super.onCreate(savedInstanceState);
        // Ouverte depuis le bouton « Partager » : le contenu attend que l'interface web soit prête.
        PartagePlugin.recevoir(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // launchMode="singleTask" : l'application tourne déjà, c'est ici qu'arrive le partage.
        PartagePlugin.recevoir(intent);
    }
}
