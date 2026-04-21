package com.spentyai.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String) {
    // Auth
    object Login : Screen("login", "Sign In")

    // Main tabs
    object Dashboard : Screen("dashboard", "Dashboard")
    object Transactions : Screen("transactions", "Transactions")
    object Accounts : Screen("accounts", "Accounts")
    object Reports : Screen("reports", "Reports")
    object More : Screen("more", "More")

    // Detail screens
    object TransactionDetail : Screen("transaction/{id}", "Transaction") {
        fun createRoute(id: String) = "transaction/$id"
    }
    object AccountDetail : Screen("account/{id}", "Account") {
        fun createRoute(id: String) = "account/$id"
    }

    // Finance section (under More)
    object Invoices : Screen("invoices", "Invoices")
    object InvoiceDetail : Screen("invoice/{id}", "Invoice") {
        fun createRoute(id: String) = "invoice/$id"
    }
    object Bills : Screen("bills", "Bills")
    object BillDetail : Screen("bill/{id}", "Bill") {
        fun createRoute(id: String) = "bill/$id"
    }
    object Categories : Screen("categories", "Categories")
    object Mandates : Screen("mandates", "Mandates")
    object PaymentPlans : Screen("payment_plans", "Payment Plans")
    object TaxSummary : Screen("tax_summary", "Tax Summary")

    // People section (under More)
    object Customers : Screen("customers", "Customers")
    object CustomerDetail : Screen("customer/{id}", "Customer") {
        fun createRoute(id: String) = "customer/$id"
    }
    object Vendors : Screen("vendors", "Vendors")
    object VendorDetail : Screen("vendor/{id}", "Vendor") {
        fun createRoute(id: String) = "vendor/$id"
    }

    // Data section (under More)
    object Records : Screen("records", "Records")
    object Statements : Screen("statements", "Statements")
    object EmailSync : Screen("email_sync", "Email Sync")

    // Tools section (under More)
    object AiChat : Screen("ai_chat", "AI Chat")
    object FeatureRequests : Screen("feature_requests", "Feature Requests")
    object Support : Screen("support", "Support")

    // Account section (under More)
    object Settings : Screen("settings", "Settings")
    object BusinessProfile : Screen("business_profile", "Business Profile")
    object CurrencySettings : Screen("currency_settings", "Currency & Locale")
    object Profile : Screen("profile", "Profile")
    object Subscription : Screen("subscription", "Subscription")

    // Past Insights
    object PastInsights : Screen("past_insights", "Past Insights")
    object PastInsightDetail : Screen("past_insight/{id}", "Past Insight Detail") {
        fun createRoute(id: String) = "past_insight/$id"
    }

    // Billing
    object Billing : Screen("billing", "Billing")
    object PaymentHistory : Screen("payment_history", "Payment History")

    // Feature Request Form
    object FeatureRequestForm : Screen("feature_request_form", "New Request")

    // Subscription Paywall
    object SubscriptionPaywall : Screen("subscription_paywall", "Subscribe")
}

enum class BottomNavTab(
    val screen: Screen,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val label: String
) {
    DASHBOARD(Screen.Dashboard, Icons.Filled.Dashboard, Icons.Outlined.Dashboard, "Dashboard"),
    TRANSACTIONS(Screen.Transactions, Icons.Filled.Receipt, Icons.Outlined.Receipt, "Transactions"),
    ACCOUNTS(Screen.Accounts, Icons.Filled.AccountBalance, Icons.Outlined.AccountBalance, "Accounts"),
    REPORTS(Screen.Reports, Icons.Filled.Assessment, Icons.Outlined.Assessment, "Reports"),
    MORE(Screen.More, Icons.Filled.MoreHoriz, Icons.Outlined.MoreHoriz, "More")
}
