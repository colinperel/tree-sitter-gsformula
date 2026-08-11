-- Sourced at startup when this repo is installed as a Neovim plugin.
-- Neovim does not read tree-sitter.json's "file-types" — that field is
-- CLI-only — so the extension mapping has to be registered here.
vim.filetype.add({
  extension = {
    gsfx = "gsformula",
  },
})
