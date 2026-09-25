# How to Build Side Pane Studio

This guide covers local development and the installation guidance moved out of the [user manual](documentation/user-manual.md). If Power Platform ToolBox and Side Pane Studio are already installed and you want to configure a pane, start at [Step 1 of the manual](documentation/user-manual.md#step-1-confirm-toolbox-and-the-active-connection).

## 1. Prepare the development tools

- Install Git so you can clone the repository.
- Install Node.js and npm from [Node.js downloads](https://nodejs.org/). The project declares Node.js `>=20.19.0`; use Node.js 22.13 or newer in the 22.x line, or Node.js 24.x, to satisfy the checked-in toolchain's Vite and ESLint requirements as well.
- Use Power Platform ToolBox with host API 1.2.0 or newer and a Dataverse connection for connected testing. See [ToolBox setup](#toolbox-setup) below if needed.

On Windows or macOS, use the Node.js installer for your operating system. On Linux, follow the installation instructions linked from the Node.js download page. Open a new terminal after installation and verify the tools:

```shell
git --version
node --version
npm --version
```

Each command should print a version. Check that the Node version meets the requirements above before installing dependencies.

## 2. Get the source and install dependencies

Clone the repository and enter its root folder:

```shell
git clone https://github.com/RyanMakesAndBreaksStuff/SidepaneStudio_PPTB.git
cd SidepaneStudio_PPTB
npm install
```

If you already have a checkout, run `npm install` from that checkout instead. All commands below run from the folder containing `package.json`.

**Verify:** dependency installation completes successfully and `npm run` lists the development, build, and verification scripts.

## 3. Run the development server

Start Vite:

```shell
npm run dev
```

Open the local URL printed by Vite. Stop the server with Ctrl+C when finished.

**Verify:** Vite reports that the server is ready. A standalone browser does not provide `toolboxAPI` or `dataverseAPI`; connected features must be tested inside ToolBox. A missing-host-API message in the browser does not establish a build failure.

## 4. Verify and build the studio

Run the repository checks:

```shell
npm run typecheck
npm run lint
npm test
```

**Verify:** each command exits successfully. For coverage, run `npm run coverage`.

Build the studio application:

```shell
npm run build
```

**Verify:** the TypeScript check and Vite build succeed. The output is in `dist/`, including `index.html`, bundled assets, and the icon copied from `public/`. This build uses the PPTB-compatible output configuration in `vite.config.ts`.

To inspect the production build in a browser:

```shell
npm run preview
```

Open the URL printed by Vite. The same host-API limitation applies to this standalone preview.

## 5. Build the optional shared runtime

Build the reusable helper separately:

```shell
npm run build:runtime
```

**Verify:** `dist-runtime/sidepane.runtime.js` exists. This is the shared JavaScript helper, not the studio application. Its build configuration is `vite.runtime.config.ts`.

For **Shared Library** output, upload the runtime as a JavaScript web resource named `spstudio_/scripts/sidepane.runtime.js`, publish it, and load it before the generated handler. Makers can also download the bundled runtime from **Output → Shared Library → Download runtime**. **Basic Script** output is self-contained and does not require the shared runtime.

## 6. Test inside ToolBox

Enable **Show Debug Setting** in ToolBox settings, then use **Load Tool** for the local built project. Follow the host's [tool installation guidance](https://docs.powerplatformtoolbox.com/tool-installation) for the local-folder loading flow.

Select an active Dataverse connection and open the loaded Side Pane Studio tool. Verify that the workbench appears and metadata pickers load from that environment. Continue with [the user manual](documentation/user-manual.md) to configure and test a generated pane in a model-driven app.

For development build updates, run either command as needed:

```shell
npm run watch
```

This rebuilds on source changes. To include development sourcemaps:

```shell
npm run debug
```

Reload the tool in ToolBox after a rebuild as needed. Passing local checks and seeing the preview do not prove the published handler works in a model-driven app; publish it and exercise its configured trigger there.

## Troubleshooting

| Problem | Action | Verify |
| --- | --- | --- |
| `node` or `npm` is unavailable | Install Node.js, check PATH, and reopen the terminal. | Both version commands print a version. |
| Dependency installation reports an unsupported engine | Use a Node version compatible with the project, Vite, and ESLint requirements above, then rerun `npm install`. | Installation succeeds without an engine mismatch. |
| The browser reports missing ToolBox or Dataverse APIs | Load the built tool inside ToolBox and select a connection. | The workbench and connected metadata load. |
| Type checking, lint, or tests fail | Read the named file and diagnostic, fix the issue, and rerun that command before building. | The failed check exits successfully. |
| The shared-runtime output is missing | Run `npm run build:runtime`; the studio build is separate. | `dist-runtime/sidepane.runtime.js` exists. |

## Command reference

| Task | Command | Result |
| --- | --- | --- |
| Install dependencies | `npm install` | Local dependencies |
| Development server | `npm run dev` | Vite development URL |
| Type checking | `npm run typecheck` | TypeScript diagnostics |
| Lint | `npm run lint` | ESLint diagnostics |
| Tests | `npm test` | Vitest results |
| Coverage | `npm run coverage` | Test coverage report |
| Studio build | `npm run build` | `dist/` |
| Shared runtime | `npm run build:runtime` | `dist-runtime/sidepane.runtime.js` |
| Preview build | `npm run preview` | Vite preview URL |
| Watch builds | `npm run watch` | Rebuilt studio output |
| Debug builds | `npm run debug` | Watch builds with sourcemaps |

## ToolBox setup

Skip this section if ToolBox and Side Pane Studio are already installed. Marketplace installation uses a prebuilt package and does not require cloning or building this repository.

### Install Power Platform ToolBox

**Windows**:

1. Download the latest `.exe` from the [releases page](https://github.com/PowerPlatformToolBox/desktop-app/releases).
2. Run the installer.
3. Launch **Power Platform ToolBox** from the Start menu or the desktop shortcut.

**macOS**:

1. Download the latest `.dmg` from the [releases page](https://github.com/PowerPlatformToolBox/desktop-app/releases).
2. Open the disk image and drag **Power Platform ToolBox** to **Applications**.
3. Launch it from Applications.

**Linux**:

1. Download the latest `.AppImage` from the [releases page](https://github.com/PowerPlatformToolBox/desktop-app/releases).
2. Make it executable and start it:

```bash
# Allow the AppImage to run, then start ToolBox
chmod +x ./*.AppImage
./PowerPlatformToolBox*.AppImage
```

The file name includes the version. Use the name you downloaded.

**Verification**: ToolBox opens to its sidebar. You can see **Connections** and **Tools Marketplace** (the in-app label is **Tool Marketplace** on the quick-start screen). If a tool later reports a missing Node runtime, set the Node path in ToolBox **Settings** to the `node` binary you verified above.

### Connect Dataverse

Use an environment where you can read the tables your pane will show, and where you can publish a JavaScript web resource. Interactive sign-in is the method most makers should use. Client-secret sign-in is documented by ToolBox for app registrations and is not required here.

1. Open the **Connections** panel.
2. Click **Add Connection**.
3. Set **Connection Name** to a name you will recognize, such as `YOUR_ENVIRONMENT_NAME`.
4. Set **Environment URL** to your environment URL, such as `https://YOUR_ORG.crm.dynamics.com`.
5. Set **Authentication Type** to **Microsoft Login Prompt**.
6. Click **Add**.
7. Sign in in the browser window, including MFA if your tenant asks for it, and accept the consent prompt.

**Verification**: the connection is listed in the Connections panel and can be selected as the active connection. ToolBox shows an authentication-success message in the browser after sign-in. Official walk-through: [ToolBox quick start](https://docs.powerplatformtoolbox.com/quickstart) and [authentication](https://docs.powerplatformtoolbox.com/authentication).

### Install the published Side Pane Studio package

1. In ToolBox, click **Tools Marketplace**.
2. Search for `Side Pane Studio`.
3. Open the tool whose package is `@ryanmakes/side-pane-studio`, author Ryan Rettinger, version **1.1.1**.
4. Click **Install**.
5. If ToolBox asks for permission consent, read the request and accept it only if it matches a side-pane builder that reads Dataverse metadata. Declining consent prevents the tool from loading.
6. Open **Installed Tools** and click **Side Pane Studio**.

**Verification**: the studio header reads **Side Pane Studio**. You do not see **Dataverse API + Toolbox API unavailable** or **Connection unavailable**. The preview shows a mock Account form and a pane titled **Related Records**.

Developer-only alternatives, after you enable **Show Debug Setting** in the ToolBox settings menu:

- **Install by Package**: package name `@ryanmakes/side-pane-studio`. This path needs pnpm on the machine.
- **Load Tool** from a local folder: the root of a built Side Pane Studio project. Use this while changing the tool, not for normal maker work.

Details: [Tool installation](https://docs.powerplatformtoolbox.com/tool-installation).

