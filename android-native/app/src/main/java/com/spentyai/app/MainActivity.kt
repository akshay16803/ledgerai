package com.spentyai.app

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.spentyai.app.core.auth.AuthManager
import com.spentyai.app.core.theme.SpentyTheme
import com.spentyai.app.navigation.AppNavigation

class MainActivity : ComponentActivity() {

    private lateinit var authManager: AuthManager
    private lateinit var googleSignInClient: GoogleSignInClient

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            if (idToken != null) {
                authManager.signInWithGoogle(idToken)
            } else {
                Log.e("MainActivity", "Google Sign-In: ID token was null")
            }
        } catch (e: ApiException) {
            Log.e("MainActivity", "Google Sign-In failed: ${e.statusCode}", e)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as SpentyApp
        authManager = AuthManager(app.tokenStore, app.apiClient)

        // Configure Google Sign-In
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        setContent {
            SpentyTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SpentyAppContent(
                        authManager = authManager,
                        onGoogleSignInRequest = {
                            googleSignInLauncher.launch(googleSignInClient.signInIntent)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun SpentyAppContent(
    authManager: AuthManager,
    onGoogleSignInRequest: () -> Unit
) {
    val isAuthenticated by authManager.isAuthenticated.collectAsState()
    var hasCheckedSession by remember { mutableStateOf(false) }

    if (!hasCheckedSession) {
        authManager.checkSession()
        hasCheckedSession = true
    }

    AppNavigation(
        isAuthenticated = isAuthenticated,
        authManager = authManager,
        onGoogleSignInRequest = onGoogleSignInRequest
    )
}
