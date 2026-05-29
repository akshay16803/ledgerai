package com.spentyai.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.spentyai.app.SpentyApp
import com.spentyai.app.core.auth.AuthManager
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.accounts.AccountDetailScreen
import com.spentyai.app.features.accounts.AccountListScreen
import com.spentyai.app.features.accounts.AccountsViewModel
import com.spentyai.app.features.accounts.SubTypeManagerScreen
import com.spentyai.app.features.aichat.AIChatRepository
import com.spentyai.app.features.aichat.AIChatScreen
import com.spentyai.app.features.aichat.AIChatViewModel
import com.spentyai.app.features.auth.AuthViewModel
import com.spentyai.app.features.auth.LoginScreen
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingScreen
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.PaymentHistoryScreen
import com.spentyai.app.features.cashflow.CashFlowRepository
import com.spentyai.app.features.cashflow.CashFlowScreen
import com.spentyai.app.features.cashflow.CashFlowViewModel
import com.spentyai.app.features.categories.CategoriesViewModel
import com.spentyai.app.features.categories.CategoryListScreen
import com.spentyai.app.features.customers.CustomerListScreen
import com.spentyai.app.features.customers.CustomersViewModel
import com.spentyai.app.features.dashboard.DashboardScreen
import com.spentyai.app.features.dashboard.DashboardViewModel
import com.spentyai.app.features.emailsync.EmailSyncRepository
import com.spentyai.app.features.emailsync.EmailSyncScreen
import com.spentyai.app.features.emailsync.EmailSyncViewModel
import com.spentyai.app.features.featurerequests.FeatureRequestFormScreen
import com.spentyai.app.features.featurerequests.FeatureRequestsRepository
import com.spentyai.app.features.featurerequests.FeatureRequestsScreen
import com.spentyai.app.features.featurerequests.FeatureRequestsViewModel
import com.spentyai.app.features.invoices.InvoiceListScreen
import com.spentyai.app.features.invoices.InvoicesViewModel
import com.spentyai.app.features.more.MoreMenuScreen
import com.spentyai.app.features.onboarding.SubscriptionPaywallScreen
import com.spentyai.app.features.pastinsights.PastInsightDetailScreen
import com.spentyai.app.features.pastinsights.PastInsightsRepository
import com.spentyai.app.features.pastinsights.PastInsightsScreen
import com.spentyai.app.features.pastinsights.PastInsightsViewModel
import com.spentyai.app.features.purchases.PurchaseListScreen
import com.spentyai.app.features.purchases.PurchasesViewModel
import com.spentyai.app.features.reconciliation.ReconciliationRepository
import com.spentyai.app.features.reconciliation.ReconciliationScreen
import com.spentyai.app.features.reconciliation.ReconciliationViewModel
import com.spentyai.app.features.reconciliation.StatementDetailScreen
import com.spentyai.app.features.records.RecordPreviewScreen
import com.spentyai.app.features.records.RecordsRepository
import com.spentyai.app.features.records.RecordsScreen
import com.spentyai.app.features.records.RecordsViewModel
import com.spentyai.app.features.reports.ReportsScreen
import com.spentyai.app.features.reports.ReportsViewModel
import com.spentyai.app.features.settings.BusinessProfileScreen
import com.spentyai.app.features.settings.CurrencySettingsScreen
import com.spentyai.app.features.settings.SettingsRepository
import com.spentyai.app.features.settings.SettingsScreen
import com.spentyai.app.features.settings.SettingsViewModel
import com.spentyai.app.features.support.SupportRepository
import com.spentyai.app.features.support.SupportScreen
import com.spentyai.app.features.help.HelpRepository
import com.spentyai.app.features.help.HelpScreen
import com.spentyai.app.features.help.HelpViewModel
import com.spentyai.app.features.support.SupportViewModel
import com.spentyai.app.features.transactions.TransactionListScreen
import com.spentyai.app.features.transactions.TransactionsViewModel
import com.spentyai.app.features.vendors.VendorListScreen
import com.spentyai.app.features.vendors.VendorsViewModel
import com.spentyai.app.features.customers.CustomerDetailScreen
import com.spentyai.app.features.invoices.InvoicePreviewScreen
import com.spentyai.app.features.paymentplans.PaymentPlansScreen
import com.spentyai.app.features.paymentplans.PaymentPlansViewModel
import com.spentyai.app.features.purchases.PurchasePreviewScreen
import com.spentyai.app.features.transactions.TransactionDetailScreen
import com.spentyai.app.features.vendors.VendorDetailScreen
import com.spentyai.app.core.components.LoadingView
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.platform.LocalContext

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AppNavigation(
    isAuthenticated: Boolean,
    authManager: AuthManager,
    onGoogleSignInRequest: () -> Unit = {}
) {
    val navController = rememberNavController()

    if (!isAuthenticated) {
        val authViewModel = remember { AuthViewModel(authManager) }
        LoginScreen(
            viewModel = authViewModel,
            onGoogleSignInRequest = onGoogleSignInRequest
        )
        return
    }

    val apiClient = remember { SpentyApp.instance.apiClient }

    // ── Shared ViewModels ──
    val dashboardViewModel = remember { DashboardViewModel(apiClient) }
    val transactionsViewModel = remember { TransactionsViewModel(apiClient) }
    val accountsViewModel = remember { AccountsViewModel(apiClient) }
    val reportsViewModel = remember { ReportsViewModel(apiClient) }
    val categoriesViewModel = remember { CategoriesViewModel(apiClient) }
    val invoicesViewModel = remember { InvoicesViewModel(apiClient) }
    val purchasesViewModel = remember { PurchasesViewModel(apiClient) }
    val customersViewModel = remember { CustomersViewModel(apiClient) }
    val vendorsViewModel = remember { VendorsViewModel(apiClient) }
    val paymentPlansViewModel = remember { PaymentPlansViewModel(apiClient) }

    val cashFlowRepository = remember { CashFlowRepository(apiClient) }
    val cashFlowViewModel = remember { CashFlowViewModel(cashFlowRepository) }

    val reconciliationRepository = remember { ReconciliationRepository(apiClient) }
    val reconciliationViewModel = remember { ReconciliationViewModel(reconciliationRepository) }

    val emailSyncRepository = remember { EmailSyncRepository(apiClient) }
    val emailSyncViewModel = remember { EmailSyncViewModel(emailSyncRepository) }

    val recordsRepository = remember { RecordsRepository(apiClient) }
    val recordsViewModel = remember { RecordsViewModel(recordsRepository) }

    val settingsRepository = remember { SettingsRepository(apiClient) }
    val settingsViewModel = remember { SettingsViewModel(settingsRepository, authManager) }

    val context = LocalContext.current
    val billingRepository = remember { BillingRepository(apiClient) }
    val billingViewModel = remember { BillingViewModel(context.applicationContext as android.app.Application, billingRepository) }

    // ── Subscription gate (P0 — must run before any Main destination) ──
    // Mirrors iOS AppRouter: after sign-in we resolve subscription status from
    // the backend and route unsubscribed users to SubscriptionPaywallScreen
    // *with no back-stack entry to Main*. From the gate the user can only:
    //   1. Subscribe → status flips active → fall through to MainTab
    //   2. Restore Purchases → re-queries Play, may flip status active
    //   3. Sign Out → returns to LoginScreen
    // Re-fires when the user signs back in with a different account so the
    // gate decision uses fresh status, not the previous user's cached value.
    androidx.compose.runtime.LaunchedEffect(isAuthenticated) {
        if (isAuthenticated) {
            billingViewModel.loadAll()
        }
    }

    // Cross-app 402 handler: any API call that hits the backend's
    // require_active_subscription gate emits on apiClient.subscriptionExpiredFlow.
    // Re-querying status flips currentStatus.isActive=false, which triggers the
    // gate at line ~172 below to route the user to SubscriptionPaywallScreen.
    // No per-screen wiring needed — every call site keeps its existing error
    // banner UX, but expired users now get bounced to the paywall automatically.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        apiClient.subscriptionExpiredFlow.collect {
            billingViewModel.loadAll()
        }
    }

    // Pivot 2026-05-13: SpentyAI is free for every signed-in user. The
    // full-app SubscriptionPaywall is no longer presented after sign-in.
    // EmailSync + SMSSync each present their own PremiumFeatureSheet on
    // entry, reading billing state directly from `billingViewModel` —
    // no top-level isSubscriptionActive flag is needed here anymore.

    val pastInsightsRepository = remember { PastInsightsRepository(apiClient) }
    val pastInsightsViewModel = remember { PastInsightsViewModel(pastInsightsRepository) }

    val featureRequestsRepository = remember { FeatureRequestsRepository(apiClient) }
    val featureRequestsViewModel = remember { FeatureRequestsViewModel(featureRequestsRepository) }

    val aiChatRepository = remember { AIChatRepository(apiClient) }
    val aiChatViewModel = remember { AIChatViewModel(aiChatRepository) }

    val supportRepository = remember { SupportRepository(apiClient) }
    val supportViewModel = remember { SupportViewModel(supportRepository) }

    val helpRepository = remember { HelpRepository() }
    val helpViewModel = remember { HelpViewModel(helpRepository) }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Anonymous screen-view tracking: fires once per route change.
    LaunchedEffect(currentRoute) {
        currentRoute?.let { route ->
            // Strip route arguments (everything after the first '{' or '?')
            val cleanName = route.substringBefore('{').substringBefore('?').trimEnd('/')
            com.spentyai.app.core.analytics.Analytics.viewedScreen(cleanName.ifBlank { route })
        }
    }

    // Routes where the bottom bar should be hidden
    val hideBottomBarRoutes = listOf(
        Screen.TransactionDetail.route,
        Screen.AccountDetail.route,
        Screen.InvoiceDetail.route,
        Screen.BillDetail.route,
        Screen.CustomerDetail.route,
        Screen.VendorDetail.route,
        Screen.AiChat.route
        // Screen.SubscriptionPaywall.route removed — destination is no longer
        // navigated to anywhere in the app post-pivot. Settings still routes
        // to Screen.Subscription.route (the canonical entry).
    )
    val showBottomBar = currentRoute !in hideBottomBarRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                BottomNavBar(navController = navController)
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // ═══════════════════════════════════════════
            // Main Tabs
            // ═══════════════════════════════════════════

            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    viewModel = dashboardViewModel,
                    onAccountClick = { id ->
                        navController.navigate(Screen.AccountDetail.createRoute(id))
                    },
                    onTransactionClick = { id ->
                        navController.navigate(Screen.TransactionDetail.createRoute(id))
                    },
                    onNewTransactionClick = {
                        navController.navigate(Screen.Transactions.route)
                    },
                    onAIChatClick = {
                        navController.navigate(Screen.AiChat.route)
                    },
                    onProjectionClick = {
                        navController.navigate(Screen.Mandates.route)
                    }
                )
            }

            composable(Screen.Transactions.route) {
                TransactionListScreen(
                    viewModel = transactionsViewModel,
                    onTransactionClick = { transaction ->
                        navController.navigate(
                            Screen.TransactionDetail.createRoute(transaction.id)
                        )
                    }
                )
            }

            composable(Screen.Accounts.route) {
                AccountListScreen(
                    viewModel = accountsViewModel,
                    onAccountClick = { id ->
                        navController.navigate(Screen.AccountDetail.createRoute(id))
                    },
                    onSubTypeManager = {
                        navController.navigate(Screen.SubTypeManager.route)
                    }
                )
            }

            composable(Screen.SubTypeManager.route) {
                SubTypeManagerScreen(
                    viewModel = accountsViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Reports.route) {
                ReportsScreen(viewModel = reportsViewModel)
            }

            composable(Screen.More.route) {
                MoreMenuScreen(
                    onNavigate = { route -> navController.navigate(route) }
                )
            }

            // ═══════════════════════════════════════════
            // Detail Screens
            // ═══════════════════════════════════════════

            composable(
                route = Screen.TransactionDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                val txnState by transactionsViewModel.uiState.collectAsState()
                val transaction = txnState.transactions.find { it.id == id }
                if (transaction != null) {
                    TransactionDetailScreen(
                        transaction = transaction,
                        apiClient = apiClient,
                        onDismiss = { navController.popBackStack() },
                        onEdit = { navController.navigate(Screen.Transactions.route) },
                        onDeleted = { navController.popBackStack() }
                    )
                } else {
                    LoadingView()
                }
            }

            composable(
                route = Screen.AccountDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                AccountDetailScreen(
                    accountId = id,
                    viewModel = accountsViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            // ═══════════════════════════════════════════
            // Finance Section
            // ═══════════════════════════════════════════

            composable(Screen.Invoices.route) {
                InvoiceListScreen(
                    viewModel = invoicesViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateToForm = { /* handled internally */ },
                    onNavigateToPreview = { /* handled internally */ },
                    onNavigateToRecordPayment = { /* handled internally */ },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.InvoiceDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                val invState by invoicesViewModel.uiState.collectAsState()
                val invoice = invState.invoices.find { it.id == id }
                if (invoice != null) {
                    InvoicePreviewScreen(
                        invoice = invoice,
                        viewModel = invoicesViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToEdit = { navController.popBackStack() },
                        onNavigateToRecordPayment = { navController.popBackStack() }
                    )
                } else {
                    LoadingView()
                }
            }

            composable(Screen.Bills.route) {
                PurchaseListScreen(
                    viewModel = purchasesViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateToForm = { /* handled internally */ },
                    onNavigateToPreview = { /* handled internally */ },
                    onNavigateToRecordPayment = { /* handled internally */ },
                    onNavigateToUpload = { /* handled internally */ },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.BillDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                val billState by purchasesViewModel.uiState.collectAsState()
                val bill = billState.bills.find { it.id == id }
                if (bill != null) {
                    PurchasePreviewScreen(
                        bill = bill,
                        viewModel = purchasesViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToEdit = { navController.popBackStack() },
                        onNavigateToRecordPayment = { navController.popBackStack() }
                    )
                } else {
                    LoadingView()
                }
            }

            composable(Screen.Categories.route) {
                CategoryListScreen(viewModel = categoriesViewModel)
            }

            composable(Screen.Mandates.route) {
                // Mandates route is gated as Premium. CashFlow itself stays free
                // (alias "cash_flow" below); only the deep-link from Dashboard's
                // projection card / More menu's Mandates entry triggers the gate.
                val billingState by billingViewModel.uiState.collectAsState()
                val hasPremium = billingState.currentStatus?.isActive == true
                val statusLoaded = billingState.currentStatus != null
                var showPremiumSheet by remember { mutableStateOf(false) }
                var initialGateChecked by remember { mutableStateOf(false) }
                val ctx = androidx.compose.ui.platform.LocalContext.current
                val activity = ctx as? android.app.Activity

                LaunchedEffect(statusLoaded) {
                    if (!statusLoaded || initialGateChecked) return@LaunchedEffect
                    initialGateChecked = true
                    if (!hasPremium) showPremiumSheet = true
                }
                LaunchedEffect(hasPremium) {
                    if (hasPremium && showPremiumSheet) showPremiumSheet = false
                }

                if (showPremiumSheet) {
                    val closeSheet: () -> Unit = {
                        showPremiumSheet = false
                        if (!hasPremium) navController.popBackStack()
                    }
                    androidx.compose.material3.ModalBottomSheet(
                        onDismissRequest = closeSheet,
                        containerColor = MaterialTheme.colorScheme.surface
                    ) {
                        com.spentyai.app.features.billing.PremiumFeatureSheet.Bundle(
                            monthlyPriceDisplay = billingViewModel.displayPrice(
                                com.spentyai.app.features.billing.BillingRepository.PRODUCT_MONTHLY
                            ) ?: "₹199",
                            lifetimePriceDisplay = billingViewModel.displayPrice(
                                com.spentyai.app.features.billing.BillingRepository.PRODUCT_LIFETIME_OFFER
                            ) ?: "₹4,999",
                            isPurchasing = billingState.isPurchasing,
                            onSubscribe = onSub@{
                                val act = activity ?: return@onSub
                                val details = billingState.productDetailsList
                                    .firstOrNull { it.productId == com.spentyai.app.features.billing.BillingRepository.PRODUCT_MONTHLY }
                                    ?: return@onSub
                                billingViewModel.purchaseSubscription(details, act)
                            },
                            onSubscribeLifetime = onLife@{
                                val act = activity ?: return@onLife
                                billingViewModel.purchaseLifetimeOffer(act)
                            },
                            onClose = closeSheet
                        )
                    }
                }

                CashFlowScreen(viewModel = cashFlowViewModel, hasPremium = hasPremium)
            }

            // Alias used by MoreMenuScreen ("cash_flow" → CashFlow)
            // CashFlow tab itself is FREE; only the mandates drill-down section
            // inside it is gated. Pass hasPremium so CashFlowScreen can hide
            // the mandate section for free users without showing the sheet here.
            composable("cash_flow") {
                val billingState by billingViewModel.uiState.collectAsState()
                val hasPremium = billingState.currentStatus?.isActive == true
                CashFlowScreen(viewModel = cashFlowViewModel, hasPremium = hasPremium)
            }

            composable(Screen.PaymentPlans.route) {
                PaymentPlansScreen(viewModel = paymentPlansViewModel)
            }

            composable(Screen.TaxSummary.route) {
                PastInsightsScreen(
                    viewModel = pastInsightsViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToDetail = { id ->
                        navController.navigate(Screen.PastInsightDetail.createRoute(id))
                    }
                )
            }

            // ═══════════════════════════════════════════
            // People Section
            // ═══════════════════════════════════════════

            composable(Screen.Customers.route) {
                CustomerListScreen(
                    viewModel = customersViewModel,
                    onNavigateToDetail = { customer ->
                        navController.navigate(Screen.CustomerDetail.createRoute(customer.id))
                    },
                    onNavigateToForm = { /* handled internally */ }
                )
            }

            composable(
                route = Screen.CustomerDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                val custState by customersViewModel.uiState.collectAsState()
                val customer = custState.customers.find { it.id == id }
                if (customer != null) {
                    CustomerDetailScreen(
                        customer = customer,
                        viewModel = customersViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToEdit = { navController.popBackStack() }
                    )
                } else {
                    LoadingView()
                }
            }

            composable(Screen.Vendors.route) {
                VendorListScreen(
                    viewModel = vendorsViewModel,
                    onNavigateToDetail = { vendor ->
                        navController.navigate(Screen.VendorDetail.createRoute(vendor.id))
                    },
                    onNavigateToForm = { /* handled internally */ }
                )
            }

            composable(
                route = Screen.VendorDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                val vendState by vendorsViewModel.uiState.collectAsState()
                val vendor = vendState.vendors.find { it.id == id }
                if (vendor != null) {
                    VendorDetailScreen(
                        vendor = vendor,
                        viewModel = vendorsViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToEdit = { navController.popBackStack() }
                    )
                } else {
                    LoadingView()
                }
            }

            // ═══════════════════════════════════════════
            // Data Section
            // ═══════════════════════════════════════════

            composable(Screen.Records.route) {
                RecordsScreen(
                    viewModel = recordsViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateToPreview = { id ->
                        navController.navigate("record_preview/$id")
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                route = "record_preview/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                RecordPreviewScreen(
                    recordId = id,
                    viewModel = recordsViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Statements.route) {
                ReconciliationScreen(
                    viewModel = reconciliationViewModel,
                    billingViewModel = billingViewModel,
                    onStatementClick = { id ->
                        navController.navigate("statement_detail/$id")
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            // Alias used by MoreMenuScreen ("reconciliation" → Reconciliation)
            composable("reconciliation") {
                ReconciliationScreen(
                    viewModel = reconciliationViewModel,
                    billingViewModel = billingViewModel,
                    onStatementClick = { id ->
                        navController.navigate("statement_detail/$id")
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            // SMS Sync — placeholder (feature not yet built on Android)
            composable("sms_sync") {
                PlaceholderScreen("SMS Sync — Coming Soon")
            }

            composable(
                route = "statement_detail/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                StatementDetailScreen(
                    viewModel = reconciliationViewModel,
                    statementId = id,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.EmailSync.route) {
                EmailSyncScreen(
                    viewModel = emailSyncViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateToPendingReview = {
                        navController.navigate("pending_review")
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            composable("pending_review") {
                com.spentyai.app.features.emailsync.PendingReviewScreen(
                    viewModel = emailSyncViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            // ═══════════════════════════════════════════
            // Past Insights
            // ═══════════════════════════════════════════

            composable(Screen.PastInsights.route) {
                PastInsightsScreen(
                    viewModel = pastInsightsViewModel,
                    billingViewModel = billingViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToDetail = { id ->
                        navController.navigate(Screen.PastInsightDetail.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.PastInsightDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: ""
                PastInsightDetailScreen(
                    viewModel = pastInsightsViewModel,
                    summaryId = id,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // ═══════════════════════════════════════════
            // Tools
            // ═══════════════════════════════════════════

            composable(Screen.AiChat.route) {
                AIChatScreen(
                    viewModel = aiChatViewModel,
                    onClose = { navController.popBackStack() }
                )
            }

            composable(Screen.FeatureRequests.route) {
                FeatureRequestsScreen(
                    viewModel = featureRequestsViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToForm = { navController.navigate(Screen.FeatureRequestForm.route) }
                )
            }

            composable(Screen.FeatureRequestForm.route) {
                FeatureRequestFormScreen(
                    onSubmit = { title, description, category ->
                        featureRequestsViewModel.submitRequest(title, description, category)
                        navController.popBackStack()
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Support.route) {
                SupportScreen(
                    viewModel = supportViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Help.route) {
                HelpScreen(
                    viewModel = helpViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onContactSupport = { /* mailto handled inside HelpScreen */ }
                )
            }

            // ═══════════════════════════════════════════
            // Account — Settings
            // ═══════════════════════════════════════════

            composable(Screen.Settings.route) {
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToBusinessProfile = { navController.navigate(Screen.BusinessProfile.route) },
                    onNavigateToCurrencySettings = { navController.navigate(Screen.CurrencySettings.route) }
                )
            }

            composable(Screen.BusinessProfile.route) {
                BusinessProfileScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.CurrencySettings.route) {
                CurrencySettingsScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Profile.route) {
                BusinessProfileScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // ═══════════════════════════════════════════
            // Account — Billing
            // ═══════════════════════════════════════════

            composable(Screen.Billing.route) {
                BillingScreen(
                    viewModel = billingViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToPaymentHistory = { navController.navigate(Screen.PaymentHistory.route) }
                )
            }

            composable(Screen.PaymentHistory.route) {
                PaymentHistoryScreen(
                    orders = billingViewModel.uiState.value.paymentHistory,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Subscription.route) {
                SubscriptionPaywallScreen(
                    viewModel = billingViewModel,
                    onDismiss = { navController.popBackStack() },
                    onSubscribed = { navController.popBackStack() }
                )
            }
            // Note: Screen.SubscriptionPaywall.route duplicate destination
            // removed — post-pivot nothing navigates to it. Settings → Manage
            // Subscription uses Screen.Subscription.route above.
        }
    }
}

@Composable
fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = title,
            style = SpentyType.Title2
        )
    }
}
