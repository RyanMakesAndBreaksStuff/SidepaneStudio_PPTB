# Side Pane Studio Basic Usage Guide

This guide walks through the common workflow for creating a model-driven app
side pane with Side Pane Studio.

## 1. Open Side Pane Studio

1. Open Power Platform Toolbox.
2. Connect to the Dataverse environment that contains your model-driven app.
3. Launch Side Pane Studio from the toolbox.
4. Confirm the tool shows an active Dataverse connection.

If the tool reports that `toolboxAPI` is unavailable, reopen it from inside
PPTB. If it reports no active Dataverse connection, reconnect the environment
in PPTB and retry.

## 2. Choose Pane Content

In the Configure panel, choose what the side pane should open:

- **Custom page** - opens a custom page from the current solution.
- **Table record** - opens a Dataverse record.
- **Table list** - opens a Dataverse table list.
- **Web resource** - opens an HTML or JavaScript web resource.
- **Dashboard** - opens a system or personal dashboard.
- **Search** - opens global search results, optionally with pre-filled text.

Fill in the required fields for the selected target. For table-based targets,
select or enter the table name before generating code.

## 3. Configure Pane Settings

Set the pane details that control how the side pane appears:

- Pane ID
- Title
- Icon image source
- Width
- Badge value
- Header visibility
- Close behavior
- Resize behavior
- Initial selection state

Use a stable Pane ID if you want generated code to reuse or update the same
pane across multiple opens.

## 4. Select a Trigger

Choose how the generated code will be called:

- **Form on load** - opens the pane when a record form loads.
- **Command bar button (form)** - wires the pane to a form command.
- **Command bar button (grid)** - wires the pane to a main grid command.
- **Command bar button (subgrid)** - wires the pane to a subgrid command.
- **Console / Manual** - creates code you can paste into the browser console.
- **Field on change** - registers a field change handler.

For command and event triggers, set the generated function namespace and
function name to match your solution naming conventions.

## 5. Set Context Behavior

Choose how the target receives record context:

- **Current record** - uses the record from the form trigger.
- **Selected row** - uses the selected grid or subgrid row.
- **Static** - uses a fixed record ID.
- **None** - opens the pane independently.

Enable **Reuse open pane** when the same pane should stay loaded instead of
being recreated. Use **Expand on open** when the pane should become visible
immediately after the trigger runs.

## 6. Preview the Pane

Use the preview area before copying code:

1. Open the mock preview to check pane layout, title, width, and behavior.
2. Use the form preview when connected metadata and form XML are available.
3. Adjust configuration until the pane looks correct for the target app.

The preview is for validation and layout confidence. Always test generated
code in the target model-driven app before shipping.

## 7. Generate and Deploy Code

1. Open the Output panel.
2. Review validation messages and fix required fields.
3. Copy the generated JavaScript.
4. Add the code to the appropriate web resource or command action.
5. Publish the solution customizations.
6. Test the trigger in the model-driven app.

For quick experiments, use the **Console / Manual** trigger and paste the
generated code into the browser developer console while the model-driven app is
open.

## Troubleshooting

- **No connection** - reconnect the Dataverse environment in PPTB.
- **Missing metadata** - confirm the table exists and the current user can read it.
- **Pane does not open** - check the trigger function name, namespace, and command
  wiring.
- **Wrong record opens** - review the selected context mode and the trigger source.
- **Code validation fails** - complete all required fields shown in the Configure
  panel before copying output.
