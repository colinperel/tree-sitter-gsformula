package tree_sitter_gsformula_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_gsformula "github.com/colinperel/tree-sitter-gsformula/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_gsformula.Language())
	if language == nil {
		t.Errorf("Error loading Gsformula grammar")
	}
}
