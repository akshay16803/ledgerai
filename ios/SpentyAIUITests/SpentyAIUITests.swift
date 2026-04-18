import XCTest

final class SpentyAIUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Launch & Login

    func testLaunchScreen() throws {
        let spentyAIText = app.staticTexts["SpentyAI"]
        XCTAssertTrue(spentyAIText.waitForExistence(timeout: 5), "SpentyAI branding text should appear on launch")
    }

    func testLoginFlow() throws {
        let signInButton = app.buttons["Sign in with Google"]
        XCTAssertTrue(signInButton.waitForExistence(timeout: 5), "Sign in with Google button should be visible")
        signInButton.tap()
    }

    // MARK: - Tab Navigation

    func testTabNavigation() throws {
        // Assumes a logged-in state via launch argument or stub
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5), "Tab bar should be visible after login")

        let expectedTabs = ["Dashboard", "Transactions", "Accounts", "Reports", "More"]
        for tabName in expectedTabs {
            let tab = tabBar.buttons[tabName]
            XCTAssertTrue(tab.exists, "\(tabName) tab should exist in the tab bar")
            tab.tap()
            // Brief pause to let the view load
            XCTAssertTrue(tab.isSelected, "\(tabName) tab should be selected after tapping")
        }
    }

    // MARK: - Dashboard

    func testDashboardContent() throws {
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        tabBar.buttons["Dashboard"].tap()

        // Verify stat cards are present
        let statCards = app.otherElements["dashboardStatCards"]
        XCTAssertTrue(statCards.waitForExistence(timeout: 5), "Dashboard stat cards should be visible")

        // Verify accounts section
        let accountsSection = app.staticTexts["Accounts"]
        XCTAssertTrue(accountsSection.waitForExistence(timeout: 5), "Accounts section should be visible on Dashboard")
    }

    // MARK: - Transactions

    func testCreateTransaction() throws {
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        tabBar.buttons["Transactions"].tap()

        // Tap the add button
        let addButton = app.navigationBars.buttons["addTransaction"]
        if !addButton.waitForExistence(timeout: 3) {
            // Fallback: look for a "+" button
            let plusButton = app.buttons["+"]
            XCTAssertTrue(plusButton.waitForExistence(timeout: 3), "Add transaction button should exist")
            plusButton.tap()
        } else {
            addButton.tap()
        }

        // Verify the transaction form sheet appears with an amount field
        let amountField = app.textFields["amount"]
        XCTAssertTrue(amountField.waitForExistence(timeout: 5), "Amount field should appear in the transaction form")
    }

    // MARK: - More Menu

    func testMoreMenuNavigation() throws {
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        tabBar.buttons["More"].tap()

        let expectedMenuItems = [
            "Categories",
            "Cash Flow",
            "Reconciliation",
            "Settings",
            "Sales Invoices",
            "Purchase Orders",
            "Tax Reports"
        ]

        for item in expectedMenuItems {
            let menuItem = app.staticTexts[item]
            XCTAssertTrue(
                menuItem.waitForExistence(timeout: 3),
                "\(item) should be visible in the More menu"
            )
        }
    }

    // MARK: - Invoice Creation

    func testInvoiceCreation() throws {
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        // Navigate to More → Sales Invoices
        tabBar.buttons["More"].tap()

        let salesInvoices = app.staticTexts["Sales Invoices"]
        XCTAssertTrue(salesInvoices.waitForExistence(timeout: 3), "Sales Invoices menu item should exist")
        salesInvoices.tap()

        // Tap add button to create a new invoice
        let addButton = app.navigationBars.buttons["addInvoice"]
        if !addButton.waitForExistence(timeout: 3) {
            let plusButton = app.buttons["+"]
            XCTAssertTrue(plusButton.waitForExistence(timeout: 3), "Add invoice button should exist")
            plusButton.tap()
        } else {
            addButton.tap()
        }

        // Verify the invoice form appears
        let invoiceForm = app.navigationBars["New Invoice"]
        XCTAssertTrue(
            invoiceForm.waitForExistence(timeout: 5),
            "Invoice creation form should appear"
        )
    }

    // MARK: - Settings

    func testSettingsNavigation() throws {
        app.launchArguments.append("--uitesting-stub-login")
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        // Navigate to More → Settings
        tabBar.buttons["More"].tap()

        let settingsItem = app.staticTexts["Settings"]
        XCTAssertTrue(settingsItem.waitForExistence(timeout: 3), "Settings menu item should exist")
        settingsItem.tap()

        // Verify settings sections are visible
        let settingsNav = app.navigationBars["Settings"]
        XCTAssertTrue(settingsNav.waitForExistence(timeout: 5), "Settings navigation bar should appear")

        let expectedSections = ["Account", "Preferences", "Notifications", "About"]
        for section in expectedSections {
            let sectionText = app.staticTexts[section]
            XCTAssertTrue(
                sectionText.waitForExistence(timeout: 3),
                "\(section) settings section should be visible"
            )
        }
    }
}
