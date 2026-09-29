package com.bektasing.pinkculator;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Kenardan kenara: durum ve gezinme çubukları şeffaf, ikonları koyu (açık zemin).
        // Çubukların arkasında o anki ekranın kendi arka planı görünür.
        // (super.onCreate'ten sonra: Capacitor önce başlık çubuksuz temayı kurmalı.)
        SystemBarStyle bars = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT);
        EdgeToEdge.enable(this, bars, bars);

        // Sistem yazı boyutu tasarımı bozmasın.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
