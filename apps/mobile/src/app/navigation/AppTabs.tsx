import { Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@app/navigation/types";
import { AccountsScreen } from "@features/accounts/screens/AccountsScreen";
import { DashboardScreen } from "@features/dashboard/screens/DashboardScreen";
import { EmailScreen } from "@features/email/screens/EmailScreen";
import { InboxScreen } from "@features/inbox/screens/InboxScreen";
import { LedgerScreen } from "@features/ledger/screens/LedgerScreen";
import { ReconciliationScreen } from "@features/reconciliation/screens/ReconciliationScreen";
import { ReportsScreen } from "@features/reports/screens/ReportsScreen";
import { SettingsScreen } from "@features/settings/screens/SettingsScreen";
import { palette } from "@design/theme";
import { useTabBadges } from "@lib/navigation/useTabBadges";

const Tab = createBottomTabNavigator<AppTabParamList>();

const TAB_ICON: Record<keyof AppTabParamList, string> = {
  Dashboard: "◉",
  Ledger: "▤",
  Inbox: "◌",
  Email: "✉",
  Accounts: "◍",
  Reconciliation: "✓",
  Reports: "▥",
  Settings: "⚙",
};

export function AppTabs() {
  const { inboxCount } = useTabBadges();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.accentBlue,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color }) => (
          <Text style={[styles.icon, { color }]}>{TAB_ICON[route.name as keyof AppTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Ledger" component={LedgerScreen} />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarBadge: inboxCount > 0 ? inboxCount : undefined,
        }}
      />
      <Tab.Screen name="Email" component={EmailScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Reconciliation" component={ReconciliationScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    height: 72,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  icon: {
    fontSize: 16,
    fontWeight: "700",
  },
});

