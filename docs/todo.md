- units editor

- stores editor
  - [x] changes to page must trigger/clear dirty state appropriately
  - [x] editable name
  - [x] editable subtitle
  - [x] if no subtitle, don't display
    - [x] 'Add a description.' hint text appears on store Title edit mode, hides on blur if no text entered, followsing recipe editor pattern
    - [x] Edited subtitle text persist on blur and is written to DB
  - [x] 'aisles' section header
  - [x] 'Add an aisle' hint text
  - [x] Once there are 1+ cards, 'Add an aisle' hint text hides on blur, reappears below active card of focus
  - [x] editable aisle name
  - [x] 'Add an item' hint text appears in blank item list container
  - [x] responsive height/scrollable list capped at xx items in viewport
  - [x] Clicking item list enters edit mode (no need for edit button)
  - [x] paste box
  - [x] ability to reorder aisles
  - [x] aisle is deletable (ctrl click)
  - [x] freeform text editing
  - [x] suggested completion
  - [x] aisle hint text roll-over
  - 'Aisles' header should match all caps section headers on recipe page

- recipe editor
  - paste box for ingredients
  - paste box for instructions
  - [x] delete an ingredient (ctrl click)
  - delete hover mechanism for adding ingredients and subheads to a recipe
  - add space below section title (ie more padding above hint)
  - fix section title placeholder text; is too light
  - hint should persist while ingredient card is focused

**Open questions**

- what happens to deleted items?
- do i have a stores db and what's in it?
- how does variants list handle commas?
