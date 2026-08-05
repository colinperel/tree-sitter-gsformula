import XCTest
import SwiftTreeSitter
import TreeSitterGsformula

final class TreeSitterGsformulaTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_gsformula())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Gsformula grammar")
    }
}
