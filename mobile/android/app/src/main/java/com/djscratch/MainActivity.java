package com.djscratch;

import android.app.Activity;
import android.os.Bundle;
import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(null);
    }

    @Override
    protected String getMainComponentName() {
        return "dj-scratch-mobile";
    }
}
