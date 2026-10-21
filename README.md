# HighTex Desktop

<p align="center">
  <img src="./electron-vite.png" alt="HighTex Desktop Logo" width="180">
</p>

<h1 align="center">HighTex Desktop</h1>

<p align="center">
  A desktop thesis editor built for HighTex.
</p>

<p align="center">
  <a href="https://github.com/jefyokta/hightex-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/jefyokta/hightex-desktop?label=version" alt="Latest version">
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
  <strong>English</strong> · <a href="./README.id.md">Bahasa Indonesia</a>
</p>

HighTex Desktop is the desktop version of HighTex, a thesis-writing application I originally developed as my final-year project.

The goal is simple: help students focus on writing their theses instead of struggling with document formatting.

---

## Why HighTex?

> HighTex stands for **High-Level of LaTeX**.

HighTex started as my final-year project in the Information Systems program at UIN Sultan Syarif Kasim Riau.

Our program requires theses to follow strict academic formatting standards, and students are encouraged to use LaTeX to produce consistent, professional-looking documents.

LaTeX is undeniably powerful, but many students only encounter it when they begin writing their theses. As a result, a significant amount of time is spent learning commands, fixing formatting issues, and troubleshooting compilation errors instead of focusing on the research itself.

HighTex is my attempt to make thesis writing more approachable. The goal was never to replace academic standards, but to make them easier to follow through a more user-friendly writing experience.

The project started as a web application and later evolved into a desktop application.

### Why is it called HighTex if it has no LaTeX compiler?

The name came before the application's current design.

My original thesis proposal aimed to make writing with LaTeX easier. The initial idea was to convert HTML into LaTeX code and use a LaTeX compiler to generate PDFs. That was the origin of the name _High-Level of LaTeX_.

My advisor rejected that approach, explaining that a LaTeX compiler was unnecessary as long as the document's formatting could be preserved.

As a result, the compilation process was replaced with PDF generation through a browser. I kept the name, even though LaTeX is no longer part of the application's core workflow.

### What changed as a result?

Since HighTex no longer generates or processes LaTeX code, some tools that students previously used are no longer relevant.

- **SmartTA** analyzed documents by inspecting their LaTeX source code. Since HighTex no longer produces LaTeX, SmartTA is no longer used. It has been replaced by the **HighTex Validator**.

---

## Why a Desktop Application?

### No clear deployment timeline

The original plan was to deploy the web version, but there was never a clear timeline for its official release.

Friends kept asking when they would be able to use it, and I had no definite answer. As a temporary solution, I unofficially deployed the application on demand. It would only be activated when someone requested access, while we continued waiting for an official deployment.

Rather than waiting indefinitely, I decided to build a version that students could use right away.

### Server resources

A web application comes with infrastructure costs and responsibilities. Someone has to provide storage, maintain backups, monitor usage, and pay for the servers.

I once tried hosting the application on a small server myself, but it was not powerful enough. Document generation is resource-intensive, and I did not want to keep spending money on a non-profit project.

With a desktop application, documents can be stored locally on users' machines, removing many of the infrastructure constraints that would otherwise influence development decisions.

### Offline-first

Writing a thesis should not depend on internet availability.

Students should be able to keep working whether they are at home, on campus, or anywhere else without a reliable internet connection.

### More freedom to experiment

There are many features I have wanted to build for years but kept postponing because they were difficult to justify on a server:

- How much storage would they consume?
- How expensive would they be to run?
- Would they affect other users?
- Would it be safe to expose these features on a public server?

Questions like these often determined what could and could not be built. On desktop, many of those constraints are reduced, allowing features to be designed around users' needs rather than server costs.

---

## HighTex vs. HighTex Desktop

HighTex Desktop extends the HighTex web version with additional features while maintaining its core editing experience. However, some features available in the web version have not yet been implemented in the desktop version (currently, HighTex v0.9.x), while the desktop application introduces capabilities that are not available on the web.

### Not Available in HighTex Desktop

#### Signed Document Validation

Document scanning and validation are available in HighTex Desktop. However, signed validation, which provides trusted proof that a document has passed validation, has not yet been implemented.

#### DOCX Import

DOCX import was originally introduced to help existing users migrate their documents from Microsoft Word to HighTex. New users, however, may start directly with HighTex and have no existing DOCX documents to import.

Parsing and converting DOCX files is complex and requires considerable effort to ensure reliable results. For that reason, we decided not to include this feature in the desktop version for now.

#### Institutional Data Integration

Institutional data integration is not available in the desktop version because its hybrid architecture prioritizes offline usability. Integrating institutional data, such as lecturer names and other academic information, would introduce dependencies on online services.

This is one of the most significant limitations of the desktop version. Institutional data integration is a core part of what makes HighTex different from traditional writing tools like LaTeX or Microsoft Word. Without this capability, desktop users cannot fully benefit from one of HighTex's key advantages.

#### Document Versioning

Document versioning, including creating document snapshots and merging versions, is not yet available in the desktop version. This feature is intended to let users preserve previous document states and merge changes between versions.

#### Advisor Submission

Directly submitting documents to academic advisors for supervision is not yet available in the desktop version. This workflow depends on online services and integration with the academic supervision system.

#### Other Online-Dependent Features

Other features that depend on online services may also be unavailable in the desktop version. Their availability depends on whether they can be implemented without compromising the application's offline capabilities.

### Available in HighTex Desktop

#### Local Network Sharing

HighTex Desktop allows users to share documents over a local network for presentations and discussions. This enables users to present their documents to others on the same network without relying on the web version.

#### Manual Profile and Document Configuration

Users can configure their profiles and document settings manually, without depending on online institutional data. This provides greater flexibility for users who want to work independently of online services.

#### Offline Usage

HighTex Desktop supports working with documents and local configurations without requiring a continuous internet connection. This makes it suitable for users who need a more independent writing environment, even when an internet connection is unavailable.

#### Multiple Documents

The web version uses a single-document model in certain releases due to server resource limitations. HighTex Desktop removes this restriction, allowing users to create as many documents as they need.

#### More Useful Editor Extensions

HighTex Desktop is under active development, while development of the web version has been discontinued. As a result, new editor extensions and improvements are being introduced in the desktop version to provide a better writing experience.

---

## Why Electron?

The honest answer is practicality.

To be completely transparent, Electron would not be my first choice if time, resources, and maintenance capacity were unlimited. Applications built with similar technologies are often criticized for consuming more memory and system resources than traditional desktop applications. Anyone who has used Discord or WhatsApp Desktop has probably noticed this. I understand those criticisms.

However, HighTex is developed primarily by one person, and every technical decision requires balancing the ideal solution against what is realistically achievable.

### An existing foundation

HighTex existed long before the desktop version. A significant amount of work had already gone into the editor, document system, and user interface.

Rebuilding everything separately for each operating system would have meant spending years recreating work that was already done.

### Consistency across platforms

Supporting multiple operating systems is difficult. Separate implementations introduce additional complexity, more opportunities for bugs, and a greater risk of features behaving differently across platforms.

A shared codebase keeps behavior consistent and makes maintenance more manageable.

### Development speed

Every hour spent rebuilding infrastructure is an hour not spent improving the writing experience. My priority is to improve HighTex itself, not to maintain several platform-specific implementations of the same application.

### I want to finish the project

Like many personal and academic projects, HighTex could easily become trapped in an endless cycle of rewrites and architectural improvements. At some point, software needs to become usable.

Electron may not be the most elegant solution, but it is the one that allows HighTex Desktop to exist today instead of remaining unfinished. For this project, shipping mattered more than perfection.

---

## Current Status

HighTex Desktop is under active development. Features, architecture, and workflows may continue to evolve as the project grows.
