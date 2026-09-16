# HighTex Desktop Plan After v1.0.0

Before reaching v1.0.0, my main goal is to make HighTex Desktop stable, easy to use, and capable of fulfilling its intended purpose.

Once v1.0.0 is released, the focus will shift toward building the **HighTex Cloud ecosystem** and improving collaboration, synchronization, and the overall writing experience.

## Cloud

The first major focus will be bringing projects and data to the cloud.

- **Pull / Push Documents**
  - Push local documents to the cloud.
  - Pull documents from the cloud to another device.
  - Keep local projects available for offline editing.

- **Document and profile gitSynchronization**
  - Automatically synchronize changes across devices.
  - Handle conflicts when the same document is modified on multiple devices.
  - Provide clear synchronization status and conflict information.

- **Cloud Backup**
  - Automatically back up documents.
  - Keep previous versions of documents.
  - Allow users to restore older versions when needed.

- **Lecturer Data Synchronization**
  - Synchronize lecturer data from the cloud.
  - Use centralized lecturer information to prevent inconsistencies in names, NIP, and other metadata.
  - Reduce manual data entry when creating academic documents.

- Synchronize data with other study program applications.

## Online Presentation & Sharing

HighTex currently supports presentation and document sharing through a local network. The next step is to make these features available over the internet.

- Improve the existing presentation and sharing system.
- Support document sharing over the internet.
- Explore technologies such as **Cloudflare**, WebSockets, or a lightweight relay server.
- Generate temporary and secure sharing links.
- Allow presenters to control the presentation while viewers follow it in real time.
- Support advisor-student collaboration without requiring everyone to be connected to the same network.

## Editor Improvements

Continue improving the writing experience after the core editor becomes stable.

- Improve table editing.
- Provide more powerful citation management.
- Improve bibliography generation.
- Add better support for equations and mathematical content.
- Support customizable academic formatting.
- Improve pagination and print/PDF consistency.
- Improve handling of large documents.
- Make document rendering and previewing faster.

## Long-Term Direction

The long-term goal is for HighTex to become more than just a document editor.

It should become a **complete academic writing and thesis workflow platform**—from creating documents, managing references and academic metadata, collaborating with advisors, tracking revisions, and presenting documents to producing the final academic document.

The desktop application will remain **local-first**, while HighTex Cloud will provide synchronization, collaboration, backup, and online services when needed.
