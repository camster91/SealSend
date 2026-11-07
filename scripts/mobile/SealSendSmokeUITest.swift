import XCTest

final class SealSendSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testHostAGatheringOpensLogin() throws {
        let app = XCUIApplication(bundleIdentifier: "com.ashbi.sealsend")
        app.launch()

        let hostButton = app.buttons["Host a gathering"]
        XCTAssertTrue(
            hostButton.waitForExistence(timeout: 30),
            "The source-owned Host a gathering accessibility control did not appear"
        )
        hostButton.tap()

        XCTAssertTrue(
            app.staticTexts["Welcome, host."].waitForExistence(timeout: 30),
            "Host a gathering did not navigate to the source-owned login title"
        )
        XCTAssertTrue(
            app.textFields["Email address"].waitForExistence(timeout: 10),
            "The login email field did not appear after the accessibility-driven navigation"
        )
        XCTAssertTrue(app.buttons["Send sign-in code"].exists)
    }
}
