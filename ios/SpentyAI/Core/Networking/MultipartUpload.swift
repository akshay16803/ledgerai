import Foundation

struct MultipartUpload {
    static func buildBody(
        fileData: Data,
        fileName: String,
        mimeType: String,
        fieldName: String = "file",
        extraFields: [String: String]? = nil
    ) -> (Data, String) {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()

        // Add extra string fields
        if let extraFields {
            for (key, value) in extraFields {
                body.appendString("--\(boundary)\r\n")
                body.appendString("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
                body.appendString("\(value)\r\n")
            }
        }

        // Add file data
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.appendString("\r\n")
        body.appendString("--\(boundary)--\r\n")

        return (body, boundary)
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}
