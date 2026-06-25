<p align="center">
  <img src="./electron-vite.png" alt="HighTex Desktop Logo" width="180">
</p>

<h1 align="center">HighTex Desktop</h1>

<p align="center">
  Desktop thesis editor built for HighTex.
</p>

HighTex Desktop is a desktop version of HighTex, a thesis writing application originally developed as my final-year project.

The goal of HighTex is simple: help students focus on writing their thesis instead of fighting with document formatting.

---

## Why HighTex?

HighTex started as my final-year project in the Information Systems program at UIN Sultan Syarif Kasim Riau.

One of the requirements in our program is that theses must follow a strict academic formatting standard, and students are encouraged to use LaTeX to produce consistent and professional-looking documents.

While LaTeX is undeniably powerful, many students are introduced to it only when they begin writing their thesis. As a result, a significant amount of time is spent learning commands, fixing formatting issues, and searching for solutions to compilation errors instead of focusing on the research itself.

I experienced these challenges firsthand and noticed that many of my classmates faced the same difficulties.

HighTex was created as an attempt to make the thesis-writing process more approachable. The goal was never to replace academic standards, but to make them easier to follow by providing a more user-friendly writing experience.

The project originally started as a web application and later evolved into a desktop application.

---

## Why a Desktop Application?

### No clear deployment timeline

The original plan was for the web version to be deployed and used through the university.

Unfortunately, there has never been a clear answer regarding when that deployment would happen. Rather than waiting indefinitely, I decided to build a version that students can use immediately.

### No storage limitations

A web application always comes with infrastructure concerns.

Someone has to provide storage, maintain backups, monitor usage, and pay for servers.

With a desktop application, documents are stored locally on the user's machine. This removes many of the restrictions that would otherwise affect development decisions.

### Offline first

Writing a thesis should not depend on internet availability.

Students should be able to continue working whether they are at home, on campus, or somewhere without a reliable connection.

### More freedom to experiment

There are many features I have wanted to implement over the years but kept postponing because they were difficult to justify in a server-based environment.

Questions such as:

- How much storage will this consume?
- How expensive will this be to run?
- Will it affect other users?
- Is it safe to expose this feature on a public server?

often influenced what could and could not be built.

With a desktop application, many of those concerns disappear. Features can be designed around the user's needs rather than server limitations.

---

## Why Electron?

The honest answer is practicality.

To be completely transparent, Electron would not be my first choice if resources, time, and maintenance were unlimited.

Applications built on similar technologies are often criticized for consuming more memory and system resources than traditional desktop applications. Anyone who has used applications such as Discord or WhatsApp Desktop has probably noticed this at some point.

I understand those criticisms.

However, HighTex is primarily developed by one person, and every technical decision must balance idealism against reality.

### Existing foundation

HighTex already existed before the desktop version.

A significant amount of work had already been invested into the editor, document system, and user interface.

Rebuilding everything separately for each operating system would have meant spending years recreating work that was already done.

### Consistency across platforms

Supporting multiple operating systems is difficult.

Building and maintaining separate implementations would introduce more complexity, more bugs, and more opportunities for features to behave differently depending on the platform.

A shared codebase keeps behavior consistent and makes maintenance manageable.

### Development speed

Every hour spent rebuilding infrastructure is an hour not spent improving the actual writing experience.

My priority is improving HighTex itself, not maintaining multiple platform-specific versions of the same application.

### I want to finish the project

Like many personal and academic projects, HighTex could easily become trapped in an endless cycle of rewrites and architectural improvements.

At some point, software needs to be usable.

Electron may not be the most elegant solution, but it is the solution that allows HighTex Desktop to exist today instead of remaining an unfinished project.

For this project, shipping was more important than pursuing perfection.

---

## Current Status

HighTex Desktop is currently under active development.

Features, architecture, and workflows may continue to evolve as the project grows.

## macOS Note

The macOS build distributed through GitHub Releases is not notarized yet. Because of that, macOS may show a warning such as `"HighTex" is damaged and can't be opened` after downloading the DMG.

For now, this is expected for development builds. After installing HighTex, users can remove the quarantine attribute manually:

```sh
xattr -cr /Applications/HighTex.app
```

Then open HighTex again.

---
