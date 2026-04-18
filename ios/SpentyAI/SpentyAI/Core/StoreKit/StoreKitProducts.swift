import Foundation

enum StoreKitProducts {
    static let monthlyPro = "com.spentyai.pro.monthly"
    static let yearlyPro = "com.spentyai.pro.yearly"
    static let monthlyBusiness = "com.spentyai.business.monthly"
    static let yearlyBusiness = "com.spentyai.business.yearly"

    static let allProductIDs: Set<String> = [
        monthlyPro,
        yearlyPro,
        monthlyBusiness,
        yearlyBusiness
    ]

    /// The subscription group identifier shared by all subscription products.
    static let subscriptionGroupId = "20986454"

    /// Maps App Store product ID to the backend plan name
    static func backendPlanName(for productID: String) -> String? {
        switch productID {
        case monthlyPro, yearlyPro:
            return "pro"
        case monthlyBusiness, yearlyBusiness:
            return "business"
        default:
            return nil
        }
    }

    /// Maps App Store product ID to a user-facing display name
    static func displayName(for productID: String) -> String {
        switch productID {
        case monthlyPro:
            return "Pro Monthly"
        case yearlyPro:
            return "Pro Yearly"
        case monthlyBusiness:
            return "Business Monthly"
        case yearlyBusiness:
            return "Business Yearly"
        default:
            return "Unknown"
        }
    }
}
