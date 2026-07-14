Form notes:

\- Entity Type in section 2 should be a dropdown of the options present on the RS form, as that is what is being filled by this box's response.

\- The contract administrator city / state / ZIP in section 4 should mirror section 2's address box with the separate fields in a single box and drop-down for the state. The same layout should exist if "different address..." has been selected in lieu of the property address for the management address

\- The utility allowance box should only be green if it is pulling data from an rcs and/or rent schedule. If the form is blank (and no parsing has occurred), then it must be grey like all the rest. Same for any of the other cells. A blank form should only have gray cells -- the current version immediately pulls the property name in section 2 and the management address in section 9 from the newly created property in the database which makes sense, but the management address is particularly finnicky; it is currently reading ", property" - completely glitched out.

\- Most overwrites do not get picked up by the amber review warning. Some of the only ones that do are changes in rent. some edits update the number to reflect all the overrides, but they do not immediately get picked up or reflected in the review warnings.

\- The exact same functionality that is present for UA when the RS and RCS disagree should be present for the Unit Types and Units count for any/all units present in the current Rent Schedule and the RCS. If they agree, then no warning should populate. if there is an error, then the same selective decision must be made as with the UA - prioritizing the RS though.

\- Allow for the tab button (used to progress to the next box) to open dropdown menus to allow for easier navigation.

\- The utilites write-in G/E/- box must remain the same size when "-" is present. It is currently slightly wider.

\- Change the green color title from "This cycle (upload)" to "This cycle (upload or API)"

\- Shrink the current and proposed rent boxes slightly (not too much to make them cramped when rent is put in and the revert/override buttons are present) in order to include a 150% SAFMR out and editable for each unit type. It should be parsed from the RCS doc and automatically filled in once the RCS doc has been parsed. Once the property address and the unit type have been input, the future HUD API should be able to calculate the SAFMR value and override the RCS package value, displaying a discrepancy alert if the values don't line up. If the RCS package has not yet been parsed but the unit type and address are put in, then the SAFMR value should still be calculated and automatically displayed. It should then be colored green. This way, there should always be a 150 SAFMR whenever there is a unit type in the form to populate the Affordability Check and run the 150 test.







Form notes:

\- Make it possible to type out a letter or even two to narrow down or land on the state the user wants in the section of the address boxes that have a dedicated state sub-box. This should be done like many other sites where typing a letter jumps to one of the states in the menu and an arrow key can navigate the dropdown. Two letters, if they associate with a state, should lead to the state and hitting enter should lock it in.

\- The "save this field" button is not working for the Management address in section 9 when "Different address..." has been selected. Verify that all revert/save this field buttons are functioning across the form.

\- Hitting Enter in a cell that is overriding data should be the same as clicking the override button.

\- Section 6 needs to be critically rethought. It is currently way too clunky, each cell behaves differently, and the warnings are too clustered and hard to interpret -- especially if multiple unit types are present and each have issues with them. Consider removing the right hand error messages so that the unit type row can breathe more, and potentially move those error messages to under each of the cells in question. A lot of thought needs to be put into this section -- no quick fixes here. Design it like a professional.

\- The write-in G/E/- is still wrongly sized. It now no longer changes size based on the letter in the cell, but it is now a different width than all the other boxes. The width should remain static like the other cells while also matching their width.

\- Changing the E/G(/-) after a database save does not register as an override.

\- Numerous unsaved overrides are being displayed in the alert box that do not match the actual overridden cells in the form. I have no idea what is causing this significantly increased count.







Form notes:

\- Unable to populate the Custom... field under SAMFR.

\- Save this field buttons need to be present even for new first-time entries. No revert button is needed though, since there is nothing to revert to -- it's empty. Save this field needs to be present for newly write-in section 7 values. Once those write-ins are committed, a revert/save combo needs to be present should anything change to that checkbox/value(/G/E/-).

\- Changing the E/G(/-) after a database save now registers as an override, but there is now no way to revert or save the change. It should pop up the same two buttons in the same location as when the box is checked or unchecked.

\- There is still a lingering override alert that should not exist when messing with custom section 7 write-in values. I'm not sure what's causing it. I believe that it's something about the section 7 values but it could be something else. Another review is required.





Notes:

\- There is no save option when typing in a custom 150% SAFMR. There is no value being pulled from the RCS package (that code isn't written yet) nor the HUD (that code isn't written yet), so it defaults to custom, but when I type in a value, there is no save button and enter doesn't lock it blue. Pressing Save to Database at the bottom or leaving via the exit to menu at the top does save it and turn it green, which is not the correct color for the custom input -- only if the RCS or HUD API options are selected. Upon editing that saved value, there is not a revert/save button. I also noticed that the custom UA value, when saved, turns green instead of blue despite not being a calculated number like the RCS or RS options. Changing the UA value in custom doesn't bring up the revert/save feature.

\- There is a small overlap glitch of the rename and delete buttons laying over the % complete circle in the menu.

\- Add a sort by feature -- property name, date saved. No need to sort by address or FHA number.

\- I do not believe that "renewal" is the proper terminology -- I believe a section 8 renewal is typically referential of the 20 year contract renewal, these are RCS boosts/RCS Package generators and other things. "Renewal" language throughout the site doesn't make much sense.

\- Having a couple metrics previewed in the Menu's RCS choose a program page is great. I would suggest throwing in the entire Affordability Check pane into the RCS button, redesigned slightly for clarity and neatness, so that the user sees the entire picture.

\- Esc button when pressed in a property's menu page should take you back to the main menu.

\- Back to menu button within a form should take you back to the specific property's page in the menu rather than the main menu.

\- Overriding and saving the property name within the RCS form should change the name at the top of the RCS form to the left of the RCS/OCAF/etc buttons. Right now, it takes leaving and then re-entering the form for it to update.

\- Invert the colors on the main menu top banner to be more like the actual form's blue colored banner. So the banner goes from white to blue, the large text goes to white, and the logo inverts its colors.

\- Please provide clarity on which information is being stored within the RCS form that lives only in there, versus which data will be shared across the RCS, OCAF, etc. I know that those features aren't built out yet, but I would love some clarity on how the site will work if someone is generating an RCS and an OCAF at the same time with differing numbers for whatever reason. At the same time, they should feel confident that changes made in one form do save to the property's saved database so that it can be carried out across various forms/functions for the property with utmost continuity. This feels like a hard balance to strike without first building those forms out.





NOTE:

\- The RCS report is addressed to the PM on file which can be parsed to fill in that section of the RCS form automatically. Even if no RCS report is attached, the PM contact should still be a dropdown that automatically fills the email and phone number sections based on the PM team's information (uploaded and managed separately in a sort of "contact" page). Of course, there should be an option to add a custom value, which, if a pre-fed PM is selected, would clear the email and phone cells once switched to custom.

\- Ensure that there is a Date Rents Will Be Effective box in the form, automatically pulled from the current RS and able to be custom input. Green when pulled from RS and grey when custom input, just like all the rest.





\------------------------------------------------------------------------------------------------------------------------------

**PARSING SOURCE LIST:**

\[All sourced values will live as an option in a dropdown for that cell so that the user can always select that value. Cells like "state" and "POC" which already have standalone dropdown menus for separate reason from multi-source feeds must maintain their functionality throughout this overhaul.]



*Section 2*

\- Name of property: name input when property was created in menu (which trumps) \& RCS

\- Address of property: Navigator (which trumps) \& RCS

\- FHA / Section 8 # \[are these different? I think section 8 number is input by HUD.] (section 2) - RS (which trump) \& RCS

\- Name of entity: RS

\- Entity type: RS



*Section 3*

\- Point of contact (and by extension, email and phone if the POC is in the PM contacts list): RCS

\- General Partner: RS

\- Name of signatory: RS

\- Signatory title: RS



*Section 5*

\- Appraisal company: RCS

\- Appraisal address: RCS

\- Appraiser name: RCS

\- Email: RCS

\- Phone: RCS



*Section 6*

\- Date rents will be effective: RS (+1 year)

\- Unit Type, Units, UA: RS (which trumps) \& RCS

\- Current rent: RS

\- Proposed rent: RCS

\- Non-revenue producing units: RS

\- SAMFR: HUD API (which trumps) \& RCS



*Section 7*

\- All of section 7 - RS



*Section 8*

\- Sender name: Navigator or Property Contacts excel (ideally these have the same data)

\------------------------------------------------------------------------------------------------------------------------------

**TO-DO:**

1. Integrate the HUD SAFMR API.
2. Integrate the AI API for section 1 file parsing.
3. Add CA, appraiser, and community manager stored contacts. Verify that the parsing feature will automatically fill this section in like the PM contacts feature.
4. Verify that the parsing feature will assign a PM.
5. Generate the excel file.
6. Integrate the Navigator data into the app; understand which fields should be hardwired to the Navigator data (and how that will be represented vs. basic database-level saves, if any are needed after a Navigator integration); understand the presentation to the user of selecting a Navigator pre-fill.
7. Encode a pre-generation warning page that indicates to the user any discrepancies or potentially incomplete cells/sections within the form.

\------------------------------------------------------------------------------------------------------------------------------



Notes:

~~- Verify that the SAFMR and overall Affordability Check is weighting inputs correctly and properly calculating values. I could be wrong, but the asset-level SAFMR cap as well as other metrics seemed incorrect.~~

~~- Reorder section 4 to be balanced with 2 cells in each row. I am struggling to determine the optimal order, but I believe that it should lead with the name so that all the other cells can be automatically filled when I add a CA contacts database later. The order can potentially be: CA Name > CA organization > (2nd column) > Position > Address. Use your best judgement.~~

~~- Add the appraisal company address to section 5. I am struggling to determine the best order for this as well, but I would likely lead with name for the same reason as section 4. A potential order is: Appraiser name > Appraisal company > Address > Email > Phone.~~

\- Pressing the "use property address" button in the tenant notice section when another address has been saved to that cell should take on the color orange to signify an override, producing the save/revert button combo. Right now, reverting simply produces a blue value immediately, skipping the save/revert step.

\- Hitting esc while in a dropdown menu should exit the dropdown, not prompt an exit-form move like usual. Hitting esc while in an overridden provenance cell should act the same as if the user selected revert to saved data.

\- Hitting enter while in a dropdown to lock in a value should not make the page move or jitter. Similarly, you should be able to navigate any dropdown reliably with arrow keys, and the overlay for which dropdown item you are on should be darker for visibility on all screens.

\- Hitting enter when the last thing that was done was select from a dropdown cell, check a checkbox, or change the fuel type in utilities should save that value. Currently, the form is not recognizing enter as save when done after a dropdown or checkbox. Any click elsewhere in the form done after the dropdown/checkbox should terminate this process, no longer entering that previously selected cell into the saved state. That goes for all checkboxes, fuel boxes, and dropdowns (including the state, entity type, point of contact, and more).

\- Using tab to navigate does not work seamlessly. Sometimes it skips to the next cell, sometimes it makes the screen jump to a random position. In fixing this navigation feature, do not include the save/revert buttons in the navigation progression - users can always press enter or esc to save or revert; having them tab to the buttons would just be redundant and slow down navigation. Additionally, hitting tab when the last action that was done was select from a dropdown or saving/reverting a cell should progress to the next tab. This feature will likely already be integrated via the initial tab-navigation patch.

~~- Every newly created property form should begin with all section 8 boxes checked except for "Scope of repair" and "Scope of work". This represents the typical checklist form submitted in an RCS package.~~

\- Redesign for custom fields in dropdown menus: allow for the user to edit straight in the box of pre-filled/parsed cells. If the value they are editing is a pre-filled/parsed cell, then the cell should drop the tag that indicates the source of the data and switch to the custom field. The custom option should still live in the cells it is already in as an alternative way for the user to enter custom data.

\- Pressing enter to save does not work when in the CA address cell. Fix this and ensure that all address cells function properly.

\- The Date Rents Will Be Effective box is not formatting my custom entry properly. It is populating as a single number without the date overlay. Similar formatting issues extend to dollar values like in section 6, which do not have the comma overlay. Please review all cells in the form to ensure that appropriate style formatting overlays are present.

~~- Currently, checking any checkbox (such as in section 7 and 8) causes the following items to space further down due to the save/revert buttons being taller than the line; saving or reverting and thus making those boxes disappear causes the text to shift back to the original position. Ensure that these items are spaced out correctly at the onset so that they do not wiggle when being checked or edited.~~

~~- Reduce the thickness of the fuel type boxes. They are currently wider than they are tall which is rectangular and not square. The state currently dragging the width out is the "—" state. Instead of using a long em dash, use a single dash "-". Verify that all three fuel states fit comfortably within the newly formatted square~~

~~- For section 6, there is no need to have a dedicated sub-header detailing the unit type number. Currently, unit types have headers numbering them and are significantly spread apart. This is not the case for how the non-revenue units portion is designed, which is the ideal approach to emulate for the revenue producing unit types.~~

\- If for whatever reason a parsed or API pulled field is not being filled within a cell, then the cell should default to the next-in-line value (e.g., if SAFMR API isn't getting pulled, then the RCS-parsed value should automatically fill that cell; if neither the API or the parsing are successful (or no document was even uploaded), then the cell should default to custom)

\- Have the non-revenue producing units in section 6 of the form lead with unit type and then use, rather than use and then unit type. This order will better match the revenue producing section which will help the form feel more intuitive.

\- The ↺ Reset unit types to source and ↺ Reset to source buttons in section 6 are hard to notice. Also, they are functionally incorrect. The purpose of those buttons was to reset to the parsed data, but it is currently acting as a reset to database saved data. The ability to save/revert is critical when deleting unit types, but it should be seperate from the reset to parsed data - that button's functionality should be separate and also made more clear.

~~- Allow for the user to delete the unit type information, reverting BR, BA, or both to a pre-input state. That state does not need to be included as a dropdown option.~~

~~- Upon saving the form to the database, any empty unity type rows should be deleted. Do not delete if there is a value in at least one cell.~~





Form generation comments:

* ~~Only the appraiser's name is being ported into the generated owner's cover letter. Their address, email, and phone number are missing.~~
* ~~No rent values are populating the generated RS document, including but not limited to "Monthly Contract Rent Potential," "Monthly Market Rent Potential," "Yearly Contract Rent Potential," "Yearly Market Rent Potential," and "Total Rent Loss Due to Non-Revenue Units." They all currently read zero. A thorough audit of the RS document is necessary.~~
* ~~There are strange checkbox overlays within Part B, seemingly a misalignment of two overlapping checkboxes.~~
* The Appendix 9-2-2 document needs to be updated to the new one that does not have a white box overlay covering Dave Pearson's hardcoded name. I can provide a new form when you're ready, but you cannot keep corrupting it.
* The RCS report, uploaded in section 1, must be included in the PDF generation. It does not need any generation since it is simply downloading the exact document uploaded. It must also be included in the compiled RCS Report document.
* For the tenant notice document, I would like it to be such that if there is no blank property letterhead on file, then the generation will create a property specific letter head – Related logo in center on header, property name and address below – clean and universal. There must be a warning somewhere - likely next to the "generate package" button and within the file list window that appears upon clicking the button.
* Confirm which UA source is being pulled for the generated document; I assume whichever is selected in the form?
* Make the Related Logo slightly larger. Include it in the auto-generated property letterhead above the property name — same sizing as the first page cover letter.
* Review why the cover letters are printing the CA's first name, rather than the salutation + last name. It should only print the first name when there is no salutation input into the form. If there is a salutation, then it should take that and the CA's last name.
* Do not date the RS signature in Part H; this is a DocuSign step done by another team member. Leave it blank.
* Include tenant reassurance language in the tenant notice in all bold in the same paragraph following "Take notice that on July 13, 2026 we plan to submit a request for approval of increase in maximum permissible rents for Colonial Village to CGI Federal.":

  * It is important to note that as long as you continue to be eligible under the applicable HUD guidelines for Section 8, your Total Tenant Payment will generally continue to be 30% of your adjusted income. It is also important to note that this rent increase only affects residents who receive subsidy under \[property name]'s Housing Assistance Payments contract.

