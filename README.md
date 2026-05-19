# Side Pane Studio

**Side Pane Studio** is a visual builder for Dynamics 365 and Power Apps model-driven app side panes — the panels that slide in alongside a record form to show related content without navigating away.

Instead of writing JavaScript by hand, you configure your side pane through a simple interface and get ready-to-use code in seconds.

---

## What is a side pane?

Side panes are built into Dynamics 365 and Power Apps model-driven apps. They appear as a panel on the right side of any record form, letting users see related information — like a custom canvas app, a related record, or a list of table data — without leaving the page they're on.

---

## What Side Pane Studio does

- **Point-and-click configuration** — choose what opens in the pane, how wide it is, what triggers it, and how it connects to the current record
- **Live preview** — see a mock-up of your pane alongside a simulated Dynamics 365 form as you build
- **Form preview** — load an actual form layout from your connected environment to preview the pane in context
- **Code generation** — get the JavaScript snippet needed to wire up your pane, ready to paste into a web resource or command bar action
- **No coding required** — everything is configured through the UI; the code is generated for you

---

## Content types

| Type | Description |
|------|-------------|
| Custom page | A canvas app page from your solution |
| Table record | Opens a specific or context-driven Dataverse record |
| Table list | Shows a filtered view of table records |
| Web resource | Embeds an HTML or JavaScript web resource |
| Dashboard | *(Coming soon)* |
| Search | *(Coming soon)* |

---

## Getting started

Side Pane Studio runs inside **PPTB (Power Platform Toolbox)**. To use it:

1. Open PPTB and connect to a Dataverse environment
2. Launch Side Pane Studio from the toolbox
3. Configure your pane using the **Configure** panel on the left
4. Watch the live preview update in the center panel
5. Copy the generated code from the **Output** panel on the right
6. Paste the code into your solution (web resource, command bar action, or browser console for testing)

Your configuration is saved automatically and restored the next time you open the tool.

---

## Tips

- Use the **Mock** tab in the preview to see how your pane will look in a Dynamics 365 form
- Switch to the **Form** tab to load a real form layout from your connected environment
- The **Pane width** slider lets you fine-tune how much screen space the pane takes up
- Set a **Trigger type** to control when and how the pane opens — on form load, via a command bar button, or on a field change
- Use **Reuse open pane** to avoid reloading content if the pane is already visible

---

## Requirements

- Active connection to a Dataverse / Power Platform environment via PPTB
- Dynamics 365 or a Power Apps model-driven app in that environment
