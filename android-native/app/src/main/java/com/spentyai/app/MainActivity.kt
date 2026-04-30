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
import com.spentyai.app.core.onboarding.OnboardingPrefs
import com.spentyai.app.core.theme.SpentyTheme
import com.spentyai.app.features.onboarding.OnboardingScreen
import com.spentyai.app.features.onboarding.OnboardingViewModel
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
                authManager.setSignInError("Sign-in failed: could not retrieve ID token")
            }
        } catch (e: ApiException) {
            Log.e("MainActivity", "Google Sign-In failed: ${e.statusCode}", e)
            val friendlyMessage = when (e.statusCode) {
                12501 -> null // User cancelled — show nothing
                12502 -> "Sign-in timed out. Please try again."
                7    -> "No internet connection. Please check your network and try again."
                8    -> "An internal error occurred. Please try again."
                10   -> "Sign-in configuration error. Please contact support."
                else -> "Google Sign-In failed. Please try again."
            }
            if (friendlyMessage != null) {
                authManager.setSignInError(friendlyMessage)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as SpentyApp
        authManager = app.authManager

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
    val context = androidx.compose.ui.platform.LocalContext.current
    val onboardingViewModel = remember {
        OnboardingViewModel(OnboardingPrefs(context.applicationContext))
    }
    val hasSeenOnboarding by onboardingViewModel.hasSeenOnboarding.collectAsState()
    val isAuthenticated by authManager.isAuthenticated.collectAsState()
    var hasCheckedSession by remember { mutableStateOf(false) }

    if (!hasCheckedSession) {
        authManager.checkSession()
        hasCheckedSession = true
    }

    // Gate 1: Onboarding — show the 6-slide carousel before Login on first launch.
    // Mirrors iOS AppRouter: loading → onboarding → login → paywall → main.
    if (!hasSeenOnboarding) {
        OnboardingScreen(onComplete = { onboardingViewModel.markSeen() })
        return
    }

    AppNavigation(
        isAuthenticated = isAuthenticated,
        authManager = authManager,
        onGoogleSignInRequest = onGoogleSignInRequest
    )
}
