import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as WebBrowser from "expo-web-browser";
import { AppRoot } from "@app/AppRoot";

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppRoot />
    </GestureHandlerRootView>
  );
}
