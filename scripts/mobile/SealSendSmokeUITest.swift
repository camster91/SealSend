import XCTest

final class SealSendSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchesInForeground() throws {
        let app = XCUIApplication(bundleIdentifier: "com.ashbi.sealsend")
        app.launch()

        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "SealSend did not reach XCUIApplication.State.runningForeground"
        )
        XCTAssertTrue(
            app.staticTexts["Good plans. Great company."].waitForExistence(timeout: 30),
            "The source-owned welcome title did not appear while SealSend was foreground"
        )
        XCTAssertTrue(
            app.buttons["Host a gathering"].waitForExistence(timeout: 10),
            "The source-owned Host a gathering control did not appear while SealSend was foreground"
        )
    }

    func testHostAGatheringOpensLogin() throws {
        let app = XCUIApplication(bundleIdentifier: "com.ashbi.sealsend")
        app.launch()

        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "SealSend did not remain in XCUIApplication.State.runningForeground before navigation"
        )

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
