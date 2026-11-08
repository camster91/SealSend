#!/usr/bin/env bash
set -euo pipefail

# Builds a disposable XCTest UI-test-only project. It does not alter the
# candidate's generated Xcode project or app source; the already-installed
# simulator app is launched by XCUIApplication using its public bundle ID.
DEVICE_UDID="${UI_TEST_DEVICE_UDID:?UI_TEST_DEVICE_UDID is required}"
OUTPUT_ROOT="${UI_TEST_OUTPUT_ROOT:?UI_TEST_OUTPUT_ROOT is required}"
UI_TEST_CASE="${UI_TEST_CASE:-testHostAGatheringOpensLogin}"
HARNESS_ROOT="${HARNESS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
RUN_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sealsend-ios-ui-test"
PROJECT_ROOT="$RUN_ROOT/project"
PROJECT_FILE="$PROJECT_ROOT/SealSendSmokeUITests.xcodeproj"
DERIVED_DATA="$RUN_ROOT/derived"
RESULT_BUNDLE="$OUTPUT_ROOT/$UI_TEST_CASE.xcresult"

case "$UI_TEST_CASE" in
  testLaunchesInForeground|testHostAGatheringOpensLogin) ;;
  *)
    echo "Unsupported SealSend UI test case: $UI_TEST_CASE" >&2
    exit 2
    ;;
esac

rm -rf "$PROJECT_ROOT" "$DERIVED_DATA"
rm -rf "$RESULT_BUNDLE"
mkdir -p "$PROJECT_ROOT" "$OUTPUT_ROOT"
cp "$HARNESS_ROOT/scripts/mobile/SealSendSmokeUITest.swift" "$PROJECT_ROOT/SealSendSmokeUITest.swift"
cp "$HARNESS_ROOT/scripts/mobile/SealSendSmokeUITestHost.swift" "$PROJECT_ROOT/SealSendSmokeUITestHost.swift"

python3 - "$PROJECT_FILE/project.pbxproj" <<'PY'
import sys
from pathlib import Path

output = Path(sys.argv[1])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(r'''// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXBuildFile section */
		A10000000000000000000001 /* SealSendSmokeUITest.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000000000000000000002 /* SealSendSmokeUITest.swift */; };
		A10000000000000000000012 /* SealSendSmokeUITestHost.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000000000000000000010 /* SealSendSmokeUITestHost.swift */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		A10000000000000000000002 /* SealSendSmokeUITest.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SealSendSmokeUITest.swift; sourceTree = "<group>"; };
		A10000000000000000000003 /* SealSendSmokeUITests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = SealSendSmokeUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
		A10000000000000000000010 /* SealSendSmokeUITestHost.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SealSendSmokeUITestHost.swift; sourceTree = "<group>"; };
		A10000000000000000000011 /* SealSendSmokeUITestHost.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = SealSendSmokeUITestHost.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		A10000000000000000000004 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		A10000000000000000000013 /* Host Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		A10000000000000000000005 = {
			isa = PBXGroup;
			children = (
				A10000000000000000000002 /* SealSendSmokeUITest.swift */,
				A10000000000000000000010 /* SealSendSmokeUITestHost.swift */,
				A10000000000000000000006 /* Products */,
			);
			sourceTree = "<group>";
		};
		A10000000000000000000006 /* Products */ = {
			isa = PBXGroup;
			children = (
				A10000000000000000000003 /* SealSendSmokeUITests.xctest */,
				A10000000000000000000011 /* SealSendSmokeUITestHost.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		A10000000000000000000015 /* SealSendSmokeUITestHost */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = A10000000000000000000019 /* Build configuration list for PBXNativeTarget "SealSendSmokeUITestHost" */;
			buildPhases = (
				A10000000000000000000014 /* Host Sources */,
				A10000000000000000000013 /* Host Frameworks */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = SealSendSmokeUITestHost;
			productName = SealSendSmokeUITestHost;
			productReference = A10000000000000000000011 /* SealSendSmokeUITestHost.app */;
			productType = "com.apple.product-type.application";
		};
		A10000000000000000000007 /* SealSendSmokeUITests */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = A10000000000000000000008 /* Build configuration list for PBXNativeTarget "SealSendSmokeUITests" */;
			buildPhases = (
				A10000000000000000000009 /* Sources */,
				A10000000000000000000004 /* Frameworks */,
			);
			buildRules = (
			);
			dependencies = (
				A10000000000000000000016 /* Host target dependency */,
			);
			name = SealSendSmokeUITests;
			productName = SealSendSmokeUITests;
			productReference = A10000000000000000000003 /* SealSendSmokeUITests.xctest */;
			productType = "com.apple.product-type.bundle.ui-testing";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		A1000000000000000000000A /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastUpgradeCheck = 2720;
				TargetAttributes = {
					A10000000000000000000007 = {
						CreatedOnToolsVersion = 27.0;
						TestTargetID = A10000000000000000000015;
					};
					A10000000000000000000015 = {
						CreatedOnToolsVersion = 27.0;
					};
				};
			};
			buildConfigurationList = A1000000000000000000000B /* Build configuration list for PBXProject "SealSendSmokeUITests" */;
			compatibilityVersion = "Xcode 15.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = A10000000000000000000005;
			productRefGroup = A10000000000000000000006 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				A10000000000000000000015 /* SealSendSmokeUITestHost */,
				A10000000000000000000007 /* SealSendSmokeUITests */,
			);
		};
/* End PBXProject section */

/* Begin PBXTargetDependency section */
		A10000000000000000000016 /* Host target dependency */ = {
			isa = PBXTargetDependency;
			target = A10000000000000000000015 /* SealSendSmokeUITestHost */;
			targetProxy = A10000000000000000000017 /* Host target proxy */;
		};
/* End PBXTargetDependency section */

/* Begin PBXContainerItemProxy section */
		A10000000000000000000017 /* Host target proxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = A1000000000000000000000A /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = A10000000000000000000015;
			remoteInfo = SealSendSmokeUITestHost;
		};
/* End PBXContainerItemProxy section */

/* Begin PBXSourcesBuildPhase section */
		A10000000000000000000009 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000000000000000000001 /* SealSendSmokeUITest.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		A10000000000000000000014 /* Host Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000000000000000000012 /* SealSendSmokeUITestHost.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		A1000000000000000000000C /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ashbi.sealsend.smoke.uitests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SUPPORTED_PLATFORMS = iphonesimulator;
				SDKROOT = iphonesimulator;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_TARGET_NAME = SealSendSmokeUITestHost;
			};
			name = Debug;
		};
		A1000000000000000000000D /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ashbi.sealsend.smoke.uitests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SUPPORTED_PLATFORMS = iphonesimulator;
				SDKROOT = iphonesimulator;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_TARGET_NAME = SealSendSmokeUITestHost;
			};
			name = Release;
		};
		A1000000000000000000000E /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				SDKROOT = iphonesimulator;
				SUPPORTED_PLATFORMS = iphonesimulator;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A1000000000000000000000F /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				SDKROOT = iphonesimulator;
				SUPPORTED_PLATFORMS = iphonesimulator;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		A1000000000000000000001A /* Host Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ashbi.sealsend.smoke.host;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SDKROOT = iphonesimulator;
				SUPPORTED_PLATFORMS = iphonesimulator;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A1000000000000000000001B /* Host Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CLANG_ENABLE_MODULES = YES;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ashbi.sealsend.smoke.host;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SDKROOT = iphonesimulator;
				SUPPORTED_PLATFORMS = iphonesimulator;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		A10000000000000000000008 /* Build configuration list for PBXNativeTarget "SealSendSmokeUITests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A1000000000000000000000C /* Debug */,
				A1000000000000000000000D /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		A1000000000000000000000B /* Build configuration list for PBXProject "SealSendSmokeUITests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A1000000000000000000000E /* Debug */,
				A1000000000000000000000F /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		A10000000000000000000019 /* Build configuration list for PBXNativeTarget "SealSendSmokeUITestHost" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A1000000000000000000001A /* Host Debug */,
				A1000000000000000000001B /* Host Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = A1000000000000000000000A /* Project object */;
}
''', encoding="utf-8")
PY

python3 - "$PROJECT_FILE/xcshareddata/xcschemes/SealSendSmokeUITests.xcscheme" <<'PY'
import sys
from pathlib import Path

scheme = Path(sys.argv[1])
scheme.parent.mkdir(parents=True, exist_ok=True)
scheme.write_text(r'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2720" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries>
      <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A10000000000000000000015" BuildableName="SealSendSmokeUITestHost.app" BlueprintName="SealSendSmokeUITestHost" ReferencedContainer="container:SealSendSmokeUITests.xcodeproj"/>
      </BuildActionEntry>
      <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A10000000000000000000007" BuildableName="SealSendSmokeUITests.xctest" BlueprintName="SealSendSmokeUITests" ReferencedContainer="container:SealSendSmokeUITests.xcodeproj"/>
      </BuildActionEntry>
    </BuildActionEntries>
  </BuildAction>
  <TestAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
    <Testables>
      <TestableReference skipped="NO">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A10000000000000000000007" BuildableName="SealSendSmokeUITests.xctest" BlueprintName="SealSendSmokeUITests" ReferencedContainer="container:SealSendSmokeUITests.xcodeproj"/>
      </TestableReference>
    </Testables>
  </TestAction>
  <LaunchAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES">
    <BuildableProductRunnable runnableDebuggingMode="0">
      <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A10000000000000000000015" BuildableName="SealSendSmokeUITestHost.app" BlueprintName="SealSendSmokeUITestHost" ReferencedContainer="container:SealSendSmokeUITests.xcodeproj"/>
    </BuildableProductRunnable>
  </LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"/>
  <AnalyzeAction buildConfiguration="Release"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''', encoding="utf-8")
PY

build_args=(
  test
  -project "$PROJECT_FILE"
  -scheme SealSendSmokeUITests
  -configuration Release
  -destination "platform=iOS Simulator,id=$DEVICE_UDID"
  -derivedDataPath "$DERIVED_DATA"
  -resultBundlePath "$RESULT_BUNDLE"
  CODE_SIGNING_ALLOWED=YES
  CODE_SIGNING_REQUIRED=YES
  CODE_SIGN_IDENTITY=-
  "-only-testing:SealSendSmokeUITests/SealSendSmokeUITests/$UI_TEST_CASE"
)

set +e
xcodebuild "${build_args[@]}" 2>&1 | tee "$OUTPUT_ROOT/xctest.log"
status=${PIPESTATUS[0]}
set -e
if (( status != 0 )); then
  echo "SealSend accessibility UI test failed (status $status); see $OUTPUT_ROOT/xctest.log" >&2
  exit "$status"
fi

test_case_pattern="Test Case '-\\[[^]]+ ${UI_TEST_CASE}\\]'"
started_count="$(grep -Ec "${test_case_pattern} started\\." "$OUTPUT_ROOT/xctest.log" || true)"
passed_count="$(grep -Ec "${test_case_pattern} passed" "$OUTPUT_ROOT/xctest.log" || true)"
skipped_count="$(grep -Ec "${test_case_pattern} (skipped|not run)" "$OUTPUT_ROOT/xctest.log" || true)"
if (( started_count != 1 || passed_count != 1 || skipped_count != 0 )) || \
  ! grep -Eq 'Executed [1-9][0-9]* tests?, with 0 failures' "$OUTPUT_ROOT/xctest.log"; then
  {
    printf 'testCase=%s\nstarted=%s\npassed=%s\nskipped=%s\nresultBundle=%s\n' \
      "$UI_TEST_CASE" "$started_count" "$passed_count" "$skipped_count" "$RESULT_BUNDLE"
    printf '\nRecent XCTest output:\n'
    tail -120 "$OUTPUT_ROOT/xctest.log"
  } > "$OUTPUT_ROOT/test-execution-failure.txt"
  echo "Selected SealSend XCTest did not execute exactly once and pass; see $OUTPUT_ROOT/test-execution-failure.txt and $RESULT_BUNDLE" >&2
  exit 1
fi

if [[ "$UI_TEST_CASE" == "testLaunchesInForeground" ]]; then
  printf 'passed\ndevice=%s\nbundleIdentifier=com.ashbi.sealsend\nstate=runningForeground\ntestCase=%s\ntestsExecuted=1\nexpectedUi=Good plans. Great company.;Host a gathering\nmethod=XCUIApplication exact bundle foreground assertion\nresultBundle=%s\n' \
    "$DEVICE_UDID" "$UI_TEST_CASE" "$RESULT_BUNDLE" > "$OUTPUT_ROOT/result.txt"
else
  printf 'passed\ndevice=%s\nbundleIdentifier=com.ashbi.sealsend\nstate=runningForeground\ntestCase=%s\ntestsExecuted=1\nexpectedUi=Welcome, host.;Email address;Send sign-in code\nmethod=XCUIApplication accessibility navigation Host a gathering\nresultBundle=%s\n' \
    "$DEVICE_UDID" "$UI_TEST_CASE" "$RESULT_BUNDLE" > "$OUTPUT_ROOT/result.txt"
fi
