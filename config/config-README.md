# IDMS Configuration Files

## Who should edit what

| File | Edit if you want to... | Who should edit |
|------|------------------------|-----------------|
| `userconfig.json` | Add/remove users, change passwords, assign departments | Admin |
| `factoryconfig.json` | Change equipment names, add/remove items, edit failure categories | Operator / Tech |
| `engineconfig.json` | Same, for Engine Room | Operator / Tech |
| `deckconfig.json` | Same, for Deck | Operator / Tech |
| `shells/factoryshell.json` | Change timer thresholds, export format, permissions | Developer only |
| `shells/engineshell.json` | Same, for Engine Room | Developer only |
| `shells/deckshell.json` | Same, for Deck | Developer only |

## Rules
- Edit these files with any plain text editor (Notepad, VS Code, etc.)
- JSON is strict about commas and quotes — if the app stops working after an edit, a syntax error is the most likely cause. Use https://jsonlint.com to check.
- The `shells/` folder controls how the program behaves. Only edit those files if you know what you are doing.
- After editing, save and commit to the main branch. Changes take effect on the next login.
