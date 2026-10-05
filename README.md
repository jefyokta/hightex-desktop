<p align="center">
  <img src="./electron-vite.png" alt="HighTex Desktop Logo" width="180">
</p>

<h1 align="center">HighTex Desktop</h1>

<p align="center">
  A desktop thesis editor built for HighTex.
</p>
<p align="center">
<a href="https://github.com/jefyokta/hightex-desktop/releases/latest">
  <img src="https://img.shields.io/github/v/release/jefyokta/hightex-desktop?label=version" alt="version">
</a>
</p>
<p align="center">
<a href="https://github.com/jefyokta/hightex-desktop/releases">
  <img src="https://img.shields.io/github/downloads/jefyokta/hightex-desktop/total?label=total%20downloads" alt="Total downloads">
</a>
<a href="https://github.com/jefyokta/hightex-desktop/releases/latest">
  <img src="https://img.shields.io/github/downloads/jefyokta/hightex-desktop/latest/total?label=latest%20release" alt="Latest release downloads">
</a>
</p>

<p align="center">
  <b>English</b> · <a href="./README.id.md">Bahasa Indonesia</a>
</p>

HighTex Desktop is the desktop version of HighTex, a thesis writing application I originally developed as my final-year project.

The goal is simple: help students focus on writing their thesis instead of fighting with document formatting.

---

## Why HighTex?

> HighTex, **_High-Level of LaTeX_**

HighTex started as my final-year project in the Information Systems program at UIN Sultan Syarif Kasim Riau.

Our program requires theses to follow a strict academic formatting standard, and students are encouraged to use LaTeX to produce consistent, professional-looking documents.

LaTeX is undeniably powerful, but many students only encounter it when they start writing their thesis. As a result, a significant amount of time goes into learning commands, fixing formatting issues, and searching for solutions to compilation errors instead of focusing on the research itself.

HighTex is an attempt to make thesis writing more approachable. The goal was never to replace academic standards, but to make them easier to follow through a more user-friendly writing experience.

The project started as a web application and later evolved into a desktop application.

### Why is it called HighTex if there is no LaTeX compiler inside?

The name came before the current design of the application.

My thesis originally aimed to make writing with LaTeX easier. The first idea was to parse HTML into LaTeX code and let a LaTeX compiler generate the PDF, hence _High-Level of LaTeX_. My advisor rejected that approach: there was no need for a LaTeX compiler, as long as the document stays formatted as it is.

So the compilation step was replaced with browser-generated PDFs. I kept the name, even though LaTeX is no longer part of the application's core process.

### What changed because of that

Since HighTex no longer works with LaTeX code, some tools students used before are no longer relevant:

- **SmartTA** checked documents by analyzing their LaTeX code. HighTex no longer produces any, so SmartTA is no longer used. It is replaced by the **HighTex Validator**.

---

## Why a Desktop Application?

### No clear deployment timeline

The original plan was to deploy the web version, but there has never been a clear answer on when that would happen.

Friends kept asking when they could use it, and I had no answer to give. As a temporary solution for people who needed it, I unofficially deployed it on demand: it is only active when someone asks to use it, while we keep waiting for an official deployment.

Rather than waiting indefinitely, I decided to build a version students can use right away.

### Server resources

A web application always comes with infrastructure concerns. Someone has to provide storage, maintain backups, monitor usage, and pay for servers.

I once tried deploying it on a small server myself, but it was not enough: compiling documents takes a lot of resources, and I don't want to keep paying more for a non-profit app.

With a desktop application, documents are stored locally on the user's machine, which removes many of the restrictions that would otherwise shape development decisions.

### Offline first

Writing a thesis should not depend on internet availability.

Students should be able to keep working whether they are at home, on campus, or anywhere without a reliable connection.

### More freedom to experiment

There are many features I have wanted to build for years but kept postponing because they were hard to justify on a server:

- How much storage will this consume?
- How expensive will this be to run?
- Will it affect other users?
- Is it safe to expose this feature on a public server?

Questions like these often decided what could and could not be built. On desktop, most of those concerns disappear, and features can be designed around what users need rather than what a server can afford.

---

## Why Electron?

The honest answer is practicality.

To be completely transparent, Electron would not be my first choice if resources, time, and maintenance were unlimited. Applications built on similar technologies are often criticized for using more memory and system resources than traditional desktop apps, and anyone who has used Discord or WhatsApp Desktop has probably noticed. I understand those criticisms.

However, HighTex is developed primarily by one person, and every technical decision has to balance idealism against reality.

### Existing foundation

HighTex existed before the desktop version. A significant amount of work had already gone into the editor, the document system, and the user interface.

Rebuilding all of it separately for each operating system would have meant years of recreating work that was already done.

### Consistency across platforms

Supporting multiple operating systems is hard. Separate implementations bring more complexity, more bugs, and more chances for features to behave differently per platform.

A shared codebase keeps behavior consistent and maintenance manageable.

### Development speed

Every hour spent rebuilding infrastructure is an hour not spent improving the writing experience. My priority is improving HighTex itself, not maintaining several platform-specific versions of the same app.

### I want to finish the project

Like many personal and academic projects, HighTex could easily get trapped in an endless cycle of rewrites and architectural improvements. At some point, software needs to be usable.

Electron may not be the most elegant solution, but it is the one that lets HighTex Desktop exist today instead of remaining unfinished. For this project, shipping mattered more than perfection.

---

## Current Status

HighTex Desktop is under active development. Features, architecture, and workflows may continue to evolve as the project grows.

## macOS Note

macOS builds distributed through GitHub Releases are unsigned and not notarized. This causes two known issues during installation and updating.

### Installation

After downloading the DMG, macOS may block the app with a message like `"HighTex" is damaged and can't be opened`. This is expected for unsigned builds.

To fix it, run the following command after moving HighTex to `/Applications`:

```sh
xattr -cr /Applications/HighTex.app
```

Then open HighTex normally.

### Updating

The built-in auto-updater downloads the update successfully, but Squirrel.Mac requires a valid Apple Developer certificate to apply it. Since the build is unsigned, the update is downloaded but never installed.

Once the updater finishes downloading, apply the update manually:

```sh
rm -rf /Applications/HighTex.app && unzip ~/Library/Caches/hightex-desktop-updater/update.zip -d /Applications/
```

Then relaunch HighTex.

These limitations will be resolved once the macOS build is signed and notarized with an Apple Developer certificate.
