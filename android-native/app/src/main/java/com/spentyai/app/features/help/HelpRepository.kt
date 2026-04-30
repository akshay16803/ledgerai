package com.spentyai.app.features.help

import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.Serializable

/**
 * Mirror of iOS `SupportView` / `SupportViewModel` content + `/help` web
 * articles. The backend `GET /api/help/articles` endpoint currently
 * returns 404 (per qa/backend-smoke), so this repository serves a
 * curated FAQ inline. When the backend ships the endpoint the only
 * change required will be to swap the body of `getArticles()` to call
 * `apiClient.endpoints.getHelpArticles()` and parse the response.
 */
@Serializable
data class HelpArticle(
    val id: String,
    val title: String,
    val summary: String,
    val body: String,
    val category: String
)

class HelpRepository {

    /**
     * Returns the canonical SpentyAI FAQ. Lifted from the live
     * www.spentyai.com/help articles + iOS SupportView FAQ defaults so
     * Android matches the marketing site word-for-word.
     */
    fun getArticles(): ApiResult<List<HelpArticle>> = ApiResult.Success(STATIC_ARTICLES)

    companion object {
        private val STATIC_ARTICLES = listOf(
            HelpArticle(
                id = "getting-started",
                title = "Getting started with SpentyAI",
                summary = "Sign up, connect an account, and add your first transaction.",
                body = "1. Sign in with Google.\n" +
                    "2. Open Accounts and tap + to add a bank account, credit card, or wallet.\n" +
                    "3. Open Transactions and tap + to record an expense or income, " +
                    "or connect Email Sync to import receipts automatically.\n" +
                    "4. Visit the Dashboard to see your net worth, this month's income/expenses, " +
                    "and upcoming outflows.",
                category = "Getting Started"
            ),
            HelpArticle(
                id = "email-sync",
                title = "How do I connect my email for automatic sync?",
                summary = "Gmail or Outlook receipts can be parsed into transactions automatically.",
                body = "Go to More > Email Sync and follow the prompts to connect your Gmail " +
                    "or Outlook account. SpentyAI scans incoming receipts, categorizes them, " +
                    "and queues each detected transaction in Pending Approval. You stay in " +
                    "control - nothing posts to your books until you approve it.",
                category = "Sync"
            ),
            HelpArticle(
                id = "pending-review",
                title = "What is Pending Approval?",
                summary = "AI-detected transactions wait here for your review.",
                body = "Pending transactions never affect your dashboard, cash flow, or reports. " +
                    "Open the Pending Approval section from the Dashboard or More > Email Sync " +
                    "to approve or reject each row. Approved transactions immediately update " +
                    "balances and cash-flow projections.",
                category = "Sync"
            ),
            HelpArticle(
                id = "data-security",
                title = "How is my data secured?",
                summary = "Encrypted in transit and at rest; never shared with third parties.",
                body = "All traffic between the app and api.spentyai.com uses TLS 1.3. Auth " +
                    "tokens are stored in EncryptedSharedPreferences (AES-256 keysets backed " +
                    "by Android Keystore). Server-side data is encrypted at rest with " +
                    "AES-256. We never sell or share your financial data with third parties. " +
                    "You can delete every record at any time from Settings > Reset Data or " +
                    "Settings > Delete Account.",
                category = "Security"
            ),
            HelpArticle(
                id = "export-data",
                title = "Can I export my data?",
                summary = "Yes - CSV or PDF from Reports and individual list views.",
                body = "Open Reports and use Export CSV or Export PDF to download a full " +
                    "ledger. Individual lists (Transactions, Invoices, Bills) also expose " +
                    "their own export buttons. Exports include only approved data; pending " +
                    "items are skipped by design.",
                category = "Data"
            ),
            HelpArticle(
                id = "subscription",
                title = "How do I change my subscription plan?",
                summary = "Manage subscriptions from More > Billing.",
                body = "Go to More > Billing to view available plans and manage your " +
                    "subscription. Changes take effect immediately. On Android, billing is " +
                    "handled through Google Play, so cancellations and refunds also flow " +
                    "through your Google Play account at play.google.com/store/account/" +
                    "subscriptions.",
                category = "Billing"
            ),
            HelpArticle(
                id = "reset-vs-delete",
                title = "Reset Data vs Delete Account",
                summary = "Reset wipes ledger data, Delete removes the account entirely.",
                body = "Reset Data removes all transactions, accounts, invoices, bills, " +
                    "customers, vendors, and reports - your account and settings stay " +
                    "intact. Delete Account permanently removes everything, including your " +
                    "profile and login. Both actions cannot be undone.",
                category = "Account"
            ),
            HelpArticle(
                id = "ai-chat",
                title = "What can I ask the AI?",
                summary = "Anything about your money - it pulls answers from your real ledger.",
                body = "Ask questions like \"How much did I spend on food last month?\", " +
                    "\"What's my net worth trend?\", or \"List all subscriptions over Rs 500\". " +
                    "The assistant only sees your own data and never trains on it.",
                category = "AI"
            ),
            HelpArticle(
                id = "language",
                title = "How do I switch to Hindi?",
                summary = "Settings > Language > Hindi.",
                body = "Go to More > Settings > Language and select Hindi. The app reloads " +
                    "instantly with translated labels for the most-used screens. Some " +
                    "long-form content (article bodies, AI replies) remain in the language " +
                    "they were authored in.",
                category = "App"
            ),
            HelpArticle(
                id = "contact",
                title = "Still need help?",
                summary = "Reach a real person at support@spentyai.com.",
                body = "Email support@spentyai.com with a description of your issue, the " +
                    "device model, and the app version (visible in Settings > Version). " +
                    "We reply within one business day, IST.",
                category = "Contact"
            )
        )
    }
}
