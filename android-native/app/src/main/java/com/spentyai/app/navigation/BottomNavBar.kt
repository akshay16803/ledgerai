package com.spentyai.app.navigation

import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType

@Composable
fun BottomNavBar(navController: NavController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        tonalElevation = 0.dp
    ) {
        BottomNavTab.entries.forEach { tab ->
            val tabLabel = stringResource(tab.labelRes)
            val selected = when (tab) {
                BottomNavTab.DASHBOARD -> currentRoute == Screen.Dashboard.route
                BottomNavTab.TRANSACTIONS -> currentRoute?.startsWith("transaction") == true
                BottomNavTab.ACCOUNTS -> currentRoute?.startsWith("account") == true
                BottomNavTab.REPORTS -> currentRoute == Screen.Reports.route
                BottomNavTab.MORE -> currentRoute == Screen.More.route ||
                    currentRoute in listOf(
                        Screen.Invoices.route, Screen.Bills.route,
                        Screen.Categories.route, Screen.Mandates.route,
                        Screen.PaymentPlans.route, Screen.TaxSummary.route,
                        Screen.Customers.route, Screen.Vendors.route,
                        Screen.Records.route, Screen.Statements.route,
                        Screen.EmailSync.route, Screen.AiChat.route,
                        Screen.FeatureRequests.route, Screen.Support.route,
                        Screen.Help.route,
                        Screen.Settings.route, Screen.Profile.route,
                        Screen.Subscription.route
                    )
            }

            NavigationBarItem(
                icon = {
                    Icon(
                        imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                        contentDescription = tabLabel
                    )
                },
                label = {
                    Text(
                        text = tabLabel,
                        style = SpentyType.Caption2
                    )
                },
                selected = selected,
                onClick = {
                    if (currentRoute != tab.screen.route) {
                        navController.navigate(tab.screen.route) {
                            popUpTo(Screen.Dashboard.route) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = SpentyPrimary,
                    selectedTextColor = SpentyPrimary,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    indicatorColor = SpentyPrimary.copy(alpha = 0.12f)
                )
            )
        }
    }
}
