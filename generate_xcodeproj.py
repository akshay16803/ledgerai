#!/usr/bin/env python3
"""
Generate a valid Xcode project.pbxproj for SpentyAI iOS app.
Scans Swift source files and resources, produces a complete .xcodeproj.
"""

import os
import hashlib
import collections

# === Configuration ===
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE_ROOT = os.path.join(PROJECT_ROOT, "ios", "SpentyAI", "SpentyAI")
XCODEPROJ_DIR = os.path.join(PROJECT_ROOT, "ios", "SpentyAI", "SpentyAI.xcodeproj")
PBXPROJ_PATH = os.path.join(XCODEPROJ_DIR, "project.pbxproj")

BUNDLE_ID = "com.spentyai.app"
PRODUCT_NAME = "SpentyAI"
DEPLOYMENT_TARGET = "17.0"
SWIFT_VERSION = "5.0"
ORGANIZATION = "SpentyAI"
DEV_TEAM = "857NZC8N95"

# Frameworks to link
FRAMEWORKS = [
    "StoreKit.framework",
    "AuthenticationServices.framework",
    "PDFKit.framework",
    "WebKit.framework",
    "Security.framework",
]

# === UUID Generation ===
_uuid_counter = [0]

def make_uuid(seed: str) -> str:
    """Generate a deterministic 24-char hex UUID from a seed string."""
    _uuid_counter[0] += 1
    h = hashlib.md5(f"{seed}_{_uuid_counter[0]}".encode()).hexdigest()
    return h[:24].upper()

# === Scan files ===
def scan_swift_files(root):
    """Return list of (relative_path, filename) for all .swift files."""
    results = []
    for dirpath, _, filenames in os.walk(root):
        for f in sorted(filenames):
            if f.endswith(".swift"):
                rel = os.path.relpath(os.path.join(dirpath, f), root)
                results.append((rel, f))
    return sorted(results)

def scan_resources(root):
    """Return list of (relative_path, filename, is_folder) for resources."""
    resources_dir = os.path.join(root, "Resources")
    results = []
    if os.path.isdir(resources_dir):
        for item in sorted(os.listdir(resources_dir)):
            full = os.path.join(resources_dir, item)
            rel = os.path.relpath(full, root)
            if item.endswith(".xcassets"):
                results.append((rel, item, True))
            elif item.endswith(".plist"):
                results.append((rel, item, False))
    return results

# === Build the pbxproj ===

class PBXProject:
    def __init__(self):
        self.swift_files = scan_swift_files(SOURCE_ROOT)
        self.resources = scan_resources(SOURCE_ROOT)

        # Pre-generate all UUIDs
        # File references for swift files: uuid_fileref, uuid_buildfile
        self.swift_refs = {}  # rel_path -> (fileref_uuid, buildfile_uuid)
        for rel, fname in self.swift_files:
            self.swift_refs[rel] = (make_uuid(f"fileref_{rel}"), make_uuid(f"buildfile_{rel}"))

        # Resource refs
        self.resource_refs = {}  # rel_path -> (fileref_uuid, buildfile_uuid)
        for rel, fname, is_folder in self.resources:
            self.resource_refs[rel] = (make_uuid(f"res_fileref_{rel}"), make_uuid(f"res_buildfile_{rel}"))

        # Framework refs
        self.framework_refs = {}  # name -> (fileref_uuid, buildfile_uuid)
        for fw in FRAMEWORKS:
            self.framework_refs[fw] = (make_uuid(f"fw_fileref_{fw}"), make_uuid(f"fw_buildfile_{fw}"))

        # Group UUIDs - build directory tree
        self.group_uuids = {}  # dir_path -> uuid
        self._build_groups()

        # Fixed UUIDs for project structure
        self.project_uuid = make_uuid("project")
        self.root_object_uuid = make_uuid("root_object")
        self.main_group_uuid = make_uuid("main_group")
        self.sources_phase_uuid = make_uuid("sources_phase")
        self.resources_phase_uuid = make_uuid("resources_phase")
        self.frameworks_phase_uuid = make_uuid("frameworks_phase")
        self.native_target_uuid = make_uuid("native_target")
        self.product_ref_uuid = make_uuid("product_ref")
        self.products_group_uuid = make_uuid("products_group")
        self.frameworks_group_uuid = make_uuid("frameworks_group")
        self.spentyai_group_uuid = make_uuid("spentyai_group")

        # Build configurations
        self.debug_config_uuid = make_uuid("debug_config")
        self.release_config_uuid = make_uuid("release_config")
        self.project_config_list_uuid = make_uuid("project_config_list")
        self.target_debug_config_uuid = make_uuid("target_debug_config")
        self.target_release_config_uuid = make_uuid("target_release_config")
        self.target_config_list_uuid = make_uuid("target_config_list")

    def _build_groups(self):
        """Build group UUIDs for each directory."""
        dirs = set()
        for rel, fname in self.swift_files:
            d = os.path.dirname(rel)
            while d:
                dirs.add(d)
                d = os.path.dirname(d)
        dirs.add("Resources")
        for d in sorted(dirs):
            self.group_uuids[d] = make_uuid(f"group_{d}")

    def _get_group_children(self, group_path):
        """Get direct children (files and subdirs) of a group path."""
        children_files = []
        children_dirs = set()

        for rel, fname in self.swift_files:
            d = os.path.dirname(rel)
            if d == group_path:
                children_files.append((rel, fname))
            elif d.startswith(group_path + "/"):
                # direct subdir
                rest = d[len(group_path)+1:]
                subdir = rest.split("/")[0]
                children_dirs.add(subdir)

        return sorted(children_files), sorted(children_dirs)

    def _get_top_level_items(self):
        """Get items at the root of SpentyAI source."""
        children_files = []
        children_dirs = set()

        for rel, fname in self.swift_files:
            d = os.path.dirname(rel)
            if d == "":
                children_files.append((rel, fname))
            else:
                top = d.split("/")[0]
                children_dirs.add(top)

        return sorted(children_files), sorted(children_dirs)

    def generate(self):
        lines = []
        lines.append("// !$*UTF8*$!")
        lines.append("{")
        lines.append("\tarchiveVersion = 1;")
        lines.append("\tclasses = {")
        lines.append("\t};")
        lines.append("\tobjectVersion = 56;")
        lines.append("\tobjects = {")
        lines.append("")

        # PBXBuildFile section
        lines.append("/* Begin PBXBuildFile section */")
        for rel, fname in self.swift_files:
            fr, bf = self.swift_refs[rel]
            lines.append(f"\t\t{bf} /* {fname} in Sources */ = {{isa = PBXBuildFile; fileRef = {fr} /* {fname} */; }};")
        for rel, fname, is_folder in self.resources:
            if fname == "Info.plist":
                continue  # Info.plist is not a build file
            fr, bf = self.resource_refs[rel]
            lines.append(f"\t\t{bf} /* {fname} in Resources */ = {{isa = PBXBuildFile; fileRef = {fr} /* {fname} */; }};")
        for fw in FRAMEWORKS:
            fr, bf = self.framework_refs[fw]
            lines.append(f"\t\t{bf} /* {fw} in Frameworks */ = {{isa = PBXBuildFile; fileRef = {fr} /* {fw} */; settings = {{ATTRIBUTES = (Required, ); }}; }};")
        lines.append("/* End PBXBuildFile section */")
        lines.append("")

        # PBXFileReference section
        lines.append("/* Begin PBXFileReference section */")
        for rel, fname in self.swift_files:
            fr, _ = self.swift_refs[rel]
            lines.append(f"\t\t{fr} /* {fname} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {fname}; sourceTree = \"<group>\"; }};")
        for rel, fname, is_folder in self.resources:
            fr, _ = self.resource_refs[rel]
            if fname.endswith(".xcassets"):
                lines.append(f"\t\t{fr} /* {fname} */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = {fname}; sourceTree = \"<group>\"; }};")
            elif fname.endswith(".plist"):
                lines.append(f"\t\t{fr} /* {fname} */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = {fname}; sourceTree = \"<group>\"; }};")
        for fw in FRAMEWORKS:
            fr, _ = self.framework_refs[fw]
            lines.append(f"\t\t{fr} /* {fw} */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = {fw}; path = System/Library/Frameworks/{fw}; sourceTree = SDKROOT; }};")
        # Product reference
        lines.append(f"\t\t{self.product_ref_uuid} /* {PRODUCT_NAME}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {PRODUCT_NAME}.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
        lines.append("/* End PBXFileReference section */")
        lines.append("")

        # PBXFrameworksBuildPhase
        lines.append("/* Begin PBXFrameworksBuildPhase section */")
        lines.append(f"\t\t{self.frameworks_phase_uuid} /* Frameworks */ = {{")
        lines.append("\t\t\tisa = PBXFrameworksBuildPhase;")
        lines.append("\t\t\tbuildActionMask = 2147483647;")
        lines.append("\t\t\tfiles = (")
        for fw in FRAMEWORKS:
            _, bf = self.framework_refs[fw]
            lines.append(f"\t\t\t\t{bf} /* {fw} in Frameworks */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
        lines.append("\t\t};")
        lines.append("/* End PBXFrameworksBuildPhase section */")
        lines.append("")

        # PBXGroup section
        lines.append("/* Begin PBXGroup section */")

        # Main group (top-level project group)
        lines.append(f"\t\t{self.main_group_uuid} = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        lines.append(f"\t\t\t\t{self.spentyai_group_uuid} /* {PRODUCT_NAME} */,")
        lines.append(f"\t\t\t\t{self.products_group_uuid} /* Products */,")
        lines.append(f"\t\t\t\t{self.frameworks_group_uuid} /* Frameworks */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

        # Products group
        lines.append(f"\t\t{self.products_group_uuid} /* Products */ = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        lines.append(f"\t\t\t\t{self.product_ref_uuid} /* {PRODUCT_NAME}.app */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tname = Products;")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

        # Frameworks group
        lines.append(f"\t\t{self.frameworks_group_uuid} /* Frameworks */ = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        for fw in FRAMEWORKS:
            fr, _ = self.framework_refs[fw]
            lines.append(f"\t\t\t\t{fr} /* {fw} */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tname = Frameworks;")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

        # SpentyAI source group
        top_files, top_dirs = self._get_top_level_items()
        lines.append(f"\t\t{self.spentyai_group_uuid} /* {PRODUCT_NAME} */ = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        for rel, fname in top_files:
            fr, _ = self.swift_refs[rel]
            lines.append(f"\t\t\t\t{fr} /* {fname} */,")
        for d in sorted(top_dirs):
            lines.append(f"\t\t\t\t{self.group_uuids[d]} /* {d} */,")
        # Resources group
        lines.append(f"\t\t\t\t{self.group_uuids['Resources']} /* Resources */,")
        lines.append("\t\t\t);")
        lines.append(f"\t\t\tpath = {PRODUCT_NAME};")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

        # Resources group
        lines.append(f"\t\t{self.group_uuids['Resources']} /* Resources */ = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        for rel, fname, is_folder in self.resources:
            fr, _ = self.resource_refs[rel]
            lines.append(f"\t\t\t\t{fr} /* {fname} */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tpath = Resources;")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

        # Subdirectory groups
        all_dirs = sorted(self.group_uuids.keys())
        for dir_path in all_dirs:
            if dir_path == "Resources":
                continue  # already handled
            children_files, children_dirs = self._get_group_children(dir_path)
            dir_name = os.path.basename(dir_path)
            lines.append(f"\t\t{self.group_uuids[dir_path]} /* {dir_name} */ = {{")
            lines.append("\t\t\tisa = PBXGroup;")
            lines.append("\t\t\tchildren = (")
            for rel, fname in children_files:
                fr, _ = self.swift_refs[rel]
                lines.append(f"\t\t\t\t{fr} /* {fname} */,")
            for subdir in children_dirs:
                full_subdir = dir_path + "/" + subdir
                if full_subdir in self.group_uuids:
                    lines.append(f"\t\t\t\t{self.group_uuids[full_subdir]} /* {subdir} */,")
            lines.append("\t\t\t);")
            lines.append(f"\t\t\tpath = {dir_name};")
            lines.append("\t\t\tsourceTree = \"<group>\";")
            lines.append("\t\t};")

        lines.append("/* End PBXGroup section */")
        lines.append("")

        # PBXNativeTarget
        lines.append("/* Begin PBXNativeTarget section */")
        lines.append(f"\t\t{self.native_target_uuid} /* {PRODUCT_NAME} */ = {{")
        lines.append("\t\t\tisa = PBXNativeTarget;")
        lines.append(f"\t\t\tbuildConfigurationList = {self.target_config_list_uuid} /* Build configuration list for PBXNativeTarget \"{PRODUCT_NAME}\" */;")
        lines.append("\t\t\tbuildPhases = (")
        lines.append(f"\t\t\t\t{self.sources_phase_uuid} /* Sources */,")
        lines.append(f"\t\t\t\t{self.frameworks_phase_uuid} /* Frameworks */,")
        lines.append(f"\t\t\t\t{self.resources_phase_uuid} /* Resources */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tbuildRules = (")
        lines.append("\t\t\t);")
        lines.append("\t\t\tdependencies = (")
        lines.append("\t\t\t);")
        lines.append(f"\t\t\tname = {PRODUCT_NAME};")
        lines.append(f"\t\t\tproductName = {PRODUCT_NAME};")
        lines.append(f"\t\t\tproductReference = {self.product_ref_uuid} /* {PRODUCT_NAME}.app */;")
        lines.append("\t\t\tproductType = \"com.apple.product-type.application\";")
        lines.append("\t\t};")
        lines.append("/* End PBXNativeTarget section */")
        lines.append("")

        # PBXProject
        lines.append("/* Begin PBXProject section */")
        lines.append(f"\t\t{self.root_object_uuid} /* Project object */ = {{")
        lines.append("\t\t\tisa = PBXProject;")
        lines.append("\t\t\tattributes = {")
        lines.append("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
        lines.append(f"\t\t\t\tLastSwiftUpdateCheck = 1500;")
        lines.append(f"\t\t\t\tLastUpgradeCheck = 1500;")
        lines.append(f"\t\t\t\tORGANIZATIONNAME = \"{ORGANIZATION}\";")
        lines.append("\t\t\t\tTargetAttributes = {")
        lines.append(f"\t\t\t\t\t{self.native_target_uuid} = {{")
        lines.append("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
        lines.append("\t\t\t\t\t};")
        lines.append("\t\t\t\t};")
        lines.append("\t\t\t};")
        lines.append(f"\t\t\tbuildConfigurationList = {self.project_config_list_uuid} /* Build configuration list for PBXProject \"{PRODUCT_NAME}\" */;")
        lines.append("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
        lines.append(f"\t\t\tdevelopmentRegion = en;")
        lines.append("\t\t\thasScannedForEncodings = 0;")
        lines.append("\t\t\tknownRegions = (")
        lines.append("\t\t\t\ten,")
        lines.append("\t\t\t\tBase,")
        lines.append("\t\t\t);")
        lines.append(f"\t\t\tmainGroup = {self.main_group_uuid};")
        lines.append(f"\t\t\tproductRefGroup = {self.products_group_uuid} /* Products */;")
        lines.append("\t\t\tprojectDirPath = \"\";")
        lines.append("\t\t\tprojectRoot = \"\";")
        lines.append("\t\t\ttargets = (")
        lines.append(f"\t\t\t\t{self.native_target_uuid} /* {PRODUCT_NAME} */,")
        lines.append("\t\t\t);")
        lines.append("\t\t};")
        lines.append("/* End PBXProject section */")
        lines.append("")

        # PBXResourcesBuildPhase
        lines.append("/* Begin PBXResourcesBuildPhase section */")
        lines.append(f"\t\t{self.resources_phase_uuid} /* Resources */ = {{")
        lines.append("\t\t\tisa = PBXResourcesBuildPhase;")
        lines.append("\t\t\tbuildActionMask = 2147483647;")
        lines.append("\t\t\tfiles = (")
        for rel, fname, is_folder in self.resources:
            if fname == "Info.plist":
                continue
            _, bf = self.resource_refs[rel]
            lines.append(f"\t\t\t\t{bf} /* {fname} in Resources */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
        lines.append("\t\t};")
        lines.append("/* End PBXResourcesBuildPhase section */")
        lines.append("")

        # PBXSourcesBuildPhase
        lines.append("/* Begin PBXSourcesBuildPhase section */")
        lines.append(f"\t\t{self.sources_phase_uuid} /* Sources */ = {{")
        lines.append("\t\t\tisa = PBXSourcesBuildPhase;")
        lines.append("\t\t\tbuildActionMask = 2147483647;")
        lines.append("\t\t\tfiles = (")
        for rel, fname in self.swift_files:
            _, bf = self.swift_refs[rel]
            lines.append(f"\t\t\t\t{bf} /* {fname} in Sources */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
        lines.append("\t\t};")
        lines.append("/* End PBXSourcesBuildPhase section */")
        lines.append("")

        # XCBuildConfiguration section
        lines.append("/* Begin XCBuildConfiguration section */")

        # Project-level Debug
        lines.append(f"\t\t{self.debug_config_uuid} /* Debug */ = {{")
        lines.append("\t\t\tisa = XCBuildConfiguration;")
        lines.append("\t\t\tbuildSettings = {")
        lines.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
        lines.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
        lines.append("\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
        lines.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
        lines.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
        lines.append("\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;")
        lines.append("\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;")
        lines.append("\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_COMMA = YES;")
        lines.append("\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;")
        lines.append("\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;")
        lines.append("\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;")
        lines.append("\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;")
        lines.append("\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;")
        lines.append("\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;")
        lines.append("\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;")
        lines.append("\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;")
        lines.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
        lines.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;")
        lines.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
        lines.append("\t\t\t\tENABLE_TESTABILITY = YES;")
        lines.append("\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;")
        lines.append("\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;")
        lines.append("\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;")
        lines.append("\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;")
        lines.append("\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;")
        lines.append("\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (")
        lines.append("\t\t\t\t\t\"DEBUG=1\",")
        lines.append("\t\t\t\t\t\"$(inherited)\",")
        lines.append("\t\t\t\t);")
        lines.append("\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;")
        lines.append("\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;")
        lines.append("\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;")
        lines.append("\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;")
        lines.append("\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;")
        lines.append(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
        lines.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;")
        lines.append("\t\t\t\tMTL_FAST_MATH = YES;")
        lines.append("\t\t\t\tONLY_ACTIVE_ARCH = YES;")
        lines.append("\t\t\t\tSDKROOT = iphoneos;")
        lines.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG\";")
        lines.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
        lines.append("\t\t\t};")
        lines.append("\t\t\tname = Debug;")
        lines.append("\t\t};")

        # Project-level Release
        lines.append(f"\t\t{self.release_config_uuid} /* Release */ = {{")
        lines.append("\t\t\tisa = XCBuildConfiguration;")
        lines.append("\t\t\tbuildSettings = {")
        lines.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
        lines.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
        lines.append("\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
        lines.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
        lines.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
        lines.append("\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;")
        lines.append("\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;")
        lines.append("\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_COMMA = YES;")
        lines.append("\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;")
        lines.append("\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;")
        lines.append("\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;")
        lines.append("\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;")
        lines.append("\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;")
        lines.append("\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;")
        lines.append("\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;")
        lines.append("\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;")
        lines.append("\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;")
        lines.append("\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;")
        lines.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
        lines.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";")
        lines.append("\t\t\t\tENABLE_NS_ASSERTIONS = NO;")
        lines.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
        lines.append("\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;")
        lines.append("\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;")
        lines.append("\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;")
        lines.append("\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;")
        lines.append("\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;")
        lines.append("\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;")
        lines.append("\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;")
        lines.append("\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;")
        lines.append("\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;")
        lines.append(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
        lines.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;")
        lines.append("\t\t\t\tMTL_FAST_MATH = YES;")
        lines.append("\t\t\t\tSDKROOT = iphoneos;")
        lines.append("\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;")
        lines.append("\t\t\t\tVALIDATE_PRODUCT = YES;")
        lines.append("\t\t\t};")
        lines.append("\t\t\tname = Release;")
        lines.append("\t\t};")

        # Target-level Debug
        lines.append(f"\t\t{self.target_debug_config_uuid} /* Debug */ = {{")
        lines.append("\t\t\tisa = XCBuildConfiguration;")
        lines.append("\t\t\tbuildSettings = {")
        lines.append(f"\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
        lines.append(f"\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
        lines.append(f"\t\t\t\tCODE_SIGN_STYLE = Automatic;")
        lines.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
        lines.append(f"\t\t\t\tDEVELOPMENT_TEAM = {DEV_TEAM};")
        lines.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
        lines.append(f"\t\t\t\tINFOPLIST_FILE = {PRODUCT_NAME}/Resources/Info.plist;")
        lines.append(f"\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = {PRODUCT_NAME};")
        lines.append("\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
        lines.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = \"UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
        lines.append(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
        lines.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
        lines.append("\t\t\t\t\t\"$(inherited)\",")
        lines.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
        lines.append("\t\t\t\t);")
        lines.append("\t\t\t\tMARKETING_VERSION = 1.0;")
        lines.append(f"\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = \"{BUNDLE_ID}\";")
        lines.append(f"\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
        lines.append(f"\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
        lines.append(f"\t\t\t\tSWIFT_VERSION = {SWIFT_VERSION};")
        lines.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
        lines.append("\t\t\t};")
        lines.append("\t\t\tname = Debug;")
        lines.append("\t\t};")

        # Target-level Release
        lines.append(f"\t\t{self.target_release_config_uuid} /* Release */ = {{")
        lines.append("\t\t\tisa = XCBuildConfiguration;")
        lines.append("\t\t\tbuildSettings = {")
        lines.append(f"\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
        lines.append(f"\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
        lines.append(f"\t\t\t\tCODE_SIGN_STYLE = Automatic;")
        lines.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
        lines.append(f"\t\t\t\tDEVELOPMENT_TEAM = {DEV_TEAM};")
        lines.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
        lines.append(f"\t\t\t\tINFOPLIST_FILE = {PRODUCT_NAME}/Resources/Info.plist;")
        lines.append(f"\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = {PRODUCT_NAME};")
        lines.append("\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;")
        lines.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
        lines.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = \"UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
        lines.append(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
        lines.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
        lines.append("\t\t\t\t\t\"$(inherited)\",")
        lines.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
        lines.append("\t\t\t\t);")
        lines.append("\t\t\t\tMARKETING_VERSION = 1.0;")
        lines.append(f"\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = \"{BUNDLE_ID}\";")
        lines.append(f"\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
        lines.append(f"\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
        lines.append(f"\t\t\t\tSWIFT_VERSION = {SWIFT_VERSION};")
        lines.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
        lines.append("\t\t\t};")
        lines.append("\t\t\tname = Release;")
        lines.append("\t\t};")

        lines.append("/* End XCBuildConfiguration section */")
        lines.append("")

        # XCConfigurationList section
        lines.append("/* Begin XCConfigurationList section */")
        lines.append(f"\t\t{self.project_config_list_uuid} /* Build configuration list for PBXProject \"{PRODUCT_NAME}\" */ = {{")
        lines.append("\t\t\tisa = XCConfigurationList;")
        lines.append("\t\t\tbuildConfigurations = (")
        lines.append(f"\t\t\t\t{self.debug_config_uuid} /* Debug */,")
        lines.append(f"\t\t\t\t{self.release_config_uuid} /* Release */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tdefaultConfigurationIsVisible = 0;")
        lines.append("\t\t\tdefaultConfigurationName = Release;")
        lines.append("\t\t};")
        lines.append(f"\t\t{self.target_config_list_uuid} /* Build configuration list for PBXNativeTarget \"{PRODUCT_NAME}\" */ = {{")
        lines.append("\t\t\tisa = XCConfigurationList;")
        lines.append("\t\t\tbuildConfigurations = (")
        lines.append(f"\t\t\t\t{self.target_debug_config_uuid} /* Debug */,")
        lines.append(f"\t\t\t\t{self.target_release_config_uuid} /* Release */,")
        lines.append("\t\t\t);")
        lines.append("\t\t\tdefaultConfigurationIsVisible = 0;")
        lines.append("\t\t\tdefaultConfigurationName = Release;")
        lines.append("\t\t};")
        lines.append("/* End XCConfigurationList section */")
        lines.append("")

        lines.append("\t};")
        lines.append(f"\trootObject = {self.root_object_uuid} /* Project object */;")
        lines.append("}")
        lines.append("")

        return "\n".join(lines)


def main():
    # Create xcodeproj directory structure
    workspace_dir = os.path.join(XCODEPROJ_DIR, "project.xcworkspace")
    shared_data_dir = os.path.join(workspace_dir, "xcshareddata")
    os.makedirs(XCODEPROJ_DIR, exist_ok=True)
    os.makedirs(shared_data_dir, exist_ok=True)

    # Generate project.pbxproj
    project = PBXProject()
    pbxproj_content = project.generate()

    with open(PBXPROJ_PATH, "w") as f:
        f.write(pbxproj_content)
    print(f"Generated: {PBXPROJ_PATH}")
    print(f"  - {len(project.swift_files)} Swift source files")
    print(f"  - {len(project.resources)} resource files")
    print(f"  - {len(FRAMEWORKS)} frameworks")

    # Generate contents.xcworkspacedata
    workspace_data_path = os.path.join(workspace_dir, "contents.xcworkspacedata")
    with open(workspace_data_path, "w") as f:
        f.write("""<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="self:">
   </FileRef>
</Workspace>
""")
    print(f"Generated: {workspace_data_path}")

    # Generate IDEWorkspaceChecks.plist
    checks_path = os.path.join(shared_data_dir, "IDEWorkspaceChecks.plist")
    with open(checks_path, "w") as f:
        f.write("""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>IDEDidComputeMac32BitWarning</key>
    <true/>
</dict>
</plist>
""")
    print(f"Generated: {checks_path}")

    print("\nXcode project generation complete!")
    print(f"Open in Xcode: {XCODEPROJ_DIR}")


if __name__ == "__main__":
    main()
