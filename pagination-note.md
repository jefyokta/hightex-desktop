# This is note for editor pagination feature
The feature must be `yes to all or not at all`, live in pagination feature is most wanted feature by users, but i dont decide to ship it to production yet due to
1. pagination must be follow the rule of paged js output, splitting table, paragraph,list, etc must be complete.
2. performance: avoid significant from non-paginate editor
3. numbering, referencing etc, must be correctly between pages, etc page 1 have list numberd that break into page 2, the number must be follow the prev list
4. table, every splitted table must have their original header and caption, split by row or better split by the content
5. force break must force to new page `---`

# why `yes to all or not at all`?
current hightex pagination handled by paged js for pdf output not for live editor, every time content changes, user must refresh and pagedjs will re-render the pages output, this mechanism already stable even if not best writting expreience, using live in editor pagination, that means in the future we wont need paged js at all, so the editor pagination must be stable as current mechanism.


# Stop when it is not possible
if the requirements is not possible example, we have to move another editor that support pagination, or the implementasion would break the application rule or product rule. you should stop