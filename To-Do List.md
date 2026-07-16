**PARSING SOURCE LIST:**

\[All sourced values will live as an option in a dropdown for that cell so that the user can always select that value. Cells like "state" and "POC" which already have standalone dropdown menus for separate reason from multi-source feeds must maintain their functionality throughout this overhaul.]



*Section 2*

\- Name of property: name input when property was created in menu (which trumps) > Navigator > RCS

\- Address of property: Navigator > RCS

\- FHA #: RS

\- Section 8 #: RCS

\- Name of entity: RS > Navigator

\- Entity type: RS > Navigator



*Section 3*

\- Point of contact (and by extension, email and phone if the POC is in the PM contacts list): Navigator > RCS

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

\- Unit Type, Units, UA: RS > RCS

\- Current rent: RS

\- Proposed rent: RCS

\- Non-revenue producing units: RS

\- SAMFR: HUD API > \& RCS



*Section 7*

\- All of section 7 - RS



*Section 8*

\- Sender name: Navigator or Property Contacts excel (ideally these have the same data)

\------------------------------------------------------------------------------------------------------------------------------

**TO-DO:**

1. Integrate the HUD SAFMR API.
2. Integrate the AI API for section 1 file parsing.
3. Add CA, appraiser, VP of GP, and community manager stored contacts. Verify that the parsing feature will automatically fill this section in like the PM contacts feature.
4. Verify that the parsing feature will assign a PM.
5. Generate the excel file.
6. Integrate the Navigator data into the app; understand which fields should be hardwired to the Navigator data (and how that will be represented vs. basic database-level saves, if any are needed after a Navigator integration); understand the presentation to the user of selecting a Navigator pre-fill.
7. Encode a pre-generation warning page that indicates to the user any discrepancies or potentially incomplete cells/sections within the form.
8. Develop a robust warning message architecture to alert users of missing inputs or unintentional overrides when they click "save to database," "generate," and more.
9. Add a saved package section for each property, which gives users the ability to save a specific form configuration that stays even after they go back into the form and make changes.
10. Standardize RS generation for properties with excess unit types.
11. Standardize RS generation for properties with non-section 8 units.
12. Standardize the combination of excess unit types and non-section 8 units.
13. Introduce a "revert to parsed data" for all relevant sections (e.g., unit types).
14. Non-revenue unit rent should auto-parse from the proposed rent of its matching revenue-producing unit type in the RCS report, once an RCS report is present — same auto-fill/override behavior as every other parsed field.
15. Add a way to sort by PM in the menu. Later, add a PM log-in page that opens only a certain PM's properties.
16. Include additional fuel-type checkboxes for section 7.
17. Build out more comprehensive entity type selection and entity member inclusion. The entity chosen in section 2 should provide custom dropdowns corresponding with the naming conventions of that respective entity type. Additionally, the user must be able to include additional members to section G (refer to Lansing Mansion and Beacon Hill).
18. Include a dropdown menu for CA company name within the form and contacts menu. The form's company dropdown options must reflect the companies included in the CA contact list, while the company dropdown options in the CA contact list must reflect the companies of previously added contacts. Alternatively, we can have a CA company directory and both the CA contact list and the form can pull their dropdown options from there.
19. Distinguish between the FHA # and Section 8 #. Ensure that the FHA # is parsed from the current RS, while the Section 8 # is parsed from the RCS report. Ensure that the FHA # attaches to the propsed rent schedule while the Section 8 # applies to the cover letters.

\------------------------------------------------------------------------------------------------------------------------------



