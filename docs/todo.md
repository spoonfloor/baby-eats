- units editor
- stores editor
  - [ ] changes to page must trigger/clear dirty state appropriately
  - [x] editable name
  - [x] editable subtitle
  - [ ] if no subtitle, don't display
    - [ ] 'Add a description.' hint text appears on store Title edit mode, hides on blur if no text entered, followsing recipe editor pattern
    - [ ] Edited subtitle text persist on blur and is written to DB
  - [x] 'aisles' section header
  - [x] 'Add an aisle' hint text
  - [ ] Once there are 1+ cards, 'Add an aisle' hint text hides on blur, reappears below active card of focus
  - [ ] aisle card UI
  - [ ] editable aisle name
    - [ ] no rule under aisle name; format matches
  - [ ] 'Add an item' hint text appears in blank item list container
  - [ ] responsive height/scrollable list capped at xx items in viewport
  - [ ] Clicking item list enters edit mode (no need for edit button)
  - [ ] paste box
  - [ ] ability to reorder aisles
  - [ ] aisle is deletable (ctrl click)
  - [ ] freeform text editing with suggested completion

- recipe editor
  - paste box for ingredients
  - paste box for instructions
  - delete an ingredient (ctrl click)

**Open questions**

- what happens to deleted items?
- do i have a stores db and what's in it?
- how does variants list handle commas?
