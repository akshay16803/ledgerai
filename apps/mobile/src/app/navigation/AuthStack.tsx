import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@app/providers/AuthProvider";
import { ForgotPasswordScreen } from "@features/auth/screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "@features/auth/screens/ResetPasswordScreen";
import { SignInScreen } from "@features/auth/screens/SignInScreen";
import { SignUpScreen } from "@features/auth/screens/SignUpScreen";
import type { AuthStackParamList } from "@app/navigation/types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const auth = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={auth.recoveryMode ? "ResetPassword" : "SignIn"}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="ResetPassword">
        {({ navigation }) => (
          <ResetPasswordScreen
            configured={auth.configured}
            onUpdatePassword={auth.updatePassword}
            onDismiss={() => {
              auth.dismissRecovery();
              navigation.navigate("SignIn");
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignIn">
        {({ navigation }) => (
          <SignInScreen
            configured={auth.configured}
            onSignIn={auth.signInWithPassword}
            onGoToSignUp={() => navigation.navigate("SignUp")}
            onGoToForgot={() => navigation.navigate("ForgotPassword")}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignUp">
        {({ navigation }) => (
          <SignUpScreen
            configured={auth.configured}
            onSignUp={auth.signUpWithPassword}
            onBackToSignIn={() => navigation.navigate("SignIn")}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {({ navigation }) => (
          <ForgotPasswordScreen
            configured={auth.configured}
            onSendReset={auth.sendPasswordReset}
            onBackToSignIn={() => navigation.navigate("SignIn")}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
