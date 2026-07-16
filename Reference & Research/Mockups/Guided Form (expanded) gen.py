# -*- coding: utf-8 -*-
from PIL import ImageFont
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; BLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c={}
def _f(sz,b):
    k=(round(sz*2),b)
    if k not in _c: _c[k]=ImageFont.truetype(BLD if b else REG,max(1,round(sz*2)))
    return _c[k]
def W(t,sz,b=False): return _f(sz,b).getlength(t)/2.0
SPEC={'—':'&#8212;','·':'&#183;','✓':'&#10003;','→':'&#8594;','▾':'&#9662;','●':'&#9679;','✎':'&#9998;','⚠':'&#9888;'}
def esc(s):
    s=s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    for k,v in SPEC.items(): s=s.replace(k,v)
    return s
NAVY="#1e3a5f"; INK="#1e293b"; SUB="#64748b"; MUTE="#94a3b8"; CARD="#e6ebf3"; PAGE="#f4f6fa"
PUR="#4c51bf"; TEAL="#0f766e"; ORG="#b45309"; GRN="#2f7d3a"; AMB_BG="#fdf3e5"
class SVG:
    def __init__(s,w,h,bg=PAGE):
        s.o=[f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Segoe UI\',Helvetica,Arial,sans-serif">',
             '<defs><filter id="cs" x="-3%" y="-3%" width="106%" height="112%"><feDropShadow dx="0" dy="1.5" stdDeviation="3.5" flood-color="#1e293b" flood-opacity="0.08"/></filter>'
             '<filter id="bar" x="-2%" y="-30%" width="104%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1e293b" flood-opacity="0.10"/></filter></defs>']
        s.rect(0,0,w,h,0,bg)
    def rect(s,x,y,w,h,rx,fill,stroke=None,sw=1,dash=None,op=None,filt=None):
        a=f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if dash:a+=f' stroke-dasharray="{dash}"'
        if op is not None:a+=f' opacity="{op}"'
        if filt:a+=f' filter="url(#{filt})"'
        s.o.append(a+'/>')
    def line(s,x1,y1,x2,y2,st,sw=1): s.o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{st}" stroke-width="{sw}"/>')
    def circle(s,cx,cy,r,fill,stroke=None,sw=1):
        a=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        s.o.append(a+'/>')
    def text(s,x,y,t,sz,fill,weight="400",anchor="start",italic=False):
        a=f'<text x="{x:.1f}" y="{y:.1f}" font-size="{sz}" fill="{fill}"'
        if weight!="400":a+=f' font-weight="{weight}"'
        if anchor!="start":a+=f' text-anchor="{anchor}"'
        if italic:a+=' font-style="italic"'
        s.o.append(a+f'>{esc(t)}</text>')
    def fit(s,x,y,t,sz,fill,maxw,weight="400",anchor="start"):
        b=weight not in("400","normal"); z=sz
        while z>8 and W(t,z,b)>maxw: z-=0.5
        s.text(x,y,t,round(z,1),fill,weight,anchor)
    def out(s): s.o.append('</svg>'); return "\n".join(s.o)

SRC={'db':(PUR,"database"),'cyc':(TEAL,"this cycle"),'ov':(ORG,"overridden"),'calc':(SUB,"auto")}
def fld(s,x,y,w,label,value,src,attn=False,note=None):
    acc,word=SRC[src]
    if attn: s.rect(x-12,y-15,w+20,(50 if note else 40),6,AMB_BG,stroke="#e6cfa6")
    s.rect(x-12,y-13,3,(44 if note else 34),0,acc)
    s.text(x,y,label,9.5,SUB)
    s.fit(x,y+18,value,11.5,INK,w-70)
    s.text(x+w,y,("review" if attn else word),8.5,(ORG if attn else acc),weight=("700" if attn else "400"),anchor="end")
    if note: s.text(x,y+33,note,8.5,ORG,italic=True)
def exhead(s,x,y,w,num,title,status=None):
    s.circle(x+9,y+9,9,NAVY); s.text(x+9,y+12.5,str(num),9,"#fff",weight="700",anchor="middle")
    s.text(x+28,y+13,title,13.5,INK,weight="700")
    if status=='attn': s.rect(x+w-104,y+1,104,18,9,AMB_BG,stroke="#e6cfa6"); s.text(x+w-52,y+14,"⚠ 1 to review",8.5,ORG,weight="700",anchor="middle")
    elif status=='cyc': s.rect(x+w-92,y+1,92,18,9,"#e6f1ef"); s.text(x+w-46,y+14,"this cycle",8.5,TEAL,weight="700",anchor="middle")
    elif status=='ok': s.rect(x+w-84,y+1,84,18,9,"#e7f5e9"); s.text(x+w-42,y+14,"✓ confirmed",8.5,GRN,weight="700",anchor="middle")
    s.line(x,y+28,x+w,y+28,"#e2e8f0"); return 42
def cbox(s,x,y,on):
    if on: s.rect(x,y,12,12,2,NAVY); s.text(x+6,y+9.4,"✓",8.5,"#fff",anchor="middle")
    else: s.rect(x,y,12,12,2,"#ffffff",stroke="#b6c1d0")
def citem(s,x,yb,label,on): cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155")
def uitem(s,x,yb,label,on,typ):
    cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155")
    bx=x+108; s.rect(bx,yb-10,15,12,3,"#eef2f6"); s.text(bx+7,yb-0.6,typ,8,"#475569",anchor="middle")
def witem(s,x,yb,val,bw=150):
    cbox(s,x,yb-10,bool(val)); s.rect(x+18,yb-11,bw,15,3,"#ffffff",stroke="#c7d0dc",dash="4 3")
    s.text(x+25,yb-0.6,(val if val else "write-in…"),9.5,("#334155" if val else "#aab4c1"))
EQ=[[("chk","Range",True),("chk","Dishwasher",False),("wi","Microwave")],[("chk","Refrigerator",True),("chk","Carpet",True),("wi","")],[("chk","Air Conditioner",False),("chk","Drapes",False),("wi","")],[("chk","Disposal",False),("wi",""),("wi","")]]
UT=[[("fuel","Heating",True,"G"),("fuel","Hot Water",True,"G"),("fuel","Lights, etc.",False,"E")],[("fuel","Cooling",False,"E"),("fuel","Cooking",True,"G"),("wi","")]]
SV=[[("chk","Parking",True),("wi",""),("chk","Nursing Care",False)],[("chk","Laundry",False),("wi",""),("chk","Linen/Maid Service",False)],[("chk","Swimming Pool",False),("wi",""),("wi","Elevator")],[("chk","Tennis Courts",False),("wi",""),("wi","")]]
def pcell(s,x,yb,c,cw):
    if c[0]=="chk": citem(s,x,yb,c[1],c[2])
    elif c[0]=="fuel": uitem(s,x,yb,c[1],c[2],c[3])
    elif c[0]=="wi": witem(s,x,yb,c[1],bw=cw-30)
def partb(s,x,y,w):
    cw=(w-16)/3; y0=y
    def grp(title,grid,yy):
        s.text(x,yy,title,10,"#475569",weight="600"); s.text(x+W(title,10,True)+8,yy,"◆ verbatim from executed schedule",8,MUTE)
        for ri,row in enumerate(grid):
            for ci,c in enumerate(row): pcell(s,x+ci*cw,yy+18+ri*20,c,cw)
        return yy+18+len(grid)*20+10
    y=grp("Equipment / furnishings",EQ,y0)
    y=grp("Utilities  (included · fuel type)",UT,y)
    y=grp("Services / facilities",SV,y)
    return y-y0

def build():
    Wd,H=1440,2230; s=SVG(Wd,H)
    s.rect(0,0,Wd,52,0,NAVY)
    s.text(24,32,"Renewal Package Builder",15,"#ffffff",weight="700"); s.text(258,32,"HUD Section 8 · RCS",10.5,"#9fb4d0")
    s.text(Wd-24,24,"RCS 5th-year renewal",9.5,"#9fb4d0",anchor="end"); s.text(Wd-24,38,"all sections expanded",9.5,"#9fb4d0",anchor="end")
    s.rect(0,52,Wd,54,0,"#ffffff",filt="bar")
    s.text(24,80,"Reviewing — Gates Manor Apartments",13.5,INK,weight="700"); s.text(24,96,"every field shown expanded for review",9.5,SUB)
    gx=Wd-24
    s.rect(gx-168,68,168,30,7,NAVY); s.text(gx-84,88,"Generate package",12,"#fff",weight="700",anchor="middle")
    s.rect(gx-330,68,150,30,7,"#ffffff",stroke="#c7d0dc"); s.text(gx-255,88,"Update database",11,"#475569",anchor="middle")
    chip="150% SAFMR   ✓ PASS   ·   $140,658 < $178,245"; cw=W(chip,10.5,True)+28
    s.rect(gx-346-cw,70,cw,26,13,"#e7f5e9"); s.text(gx-346-cw/2,87,chip,10.5,GRN,weight="700",anchor="middle")
    # rail
    RX=24; RW=208; ry=130; s.line(248,116,248,H-24,"#e2e8f0")
    s.text(RX,ry,"SECTIONS",9.5,MUTE,weight="700")
    items=[("Source documents","cyc"),("Property","ok"),("Owner & signatory","ok"),("Contract admin","attn"),("Appraiser","ok"),("Rents & unit mix","attn"),("Items in rent (Part B)","ok"),("Owner's checklist","ok"),("Tenant notice","ok")]
    yy=ry+22
    for i,(nm,st) in enumerate(items):
        if st=='ok': s.circle(RX+7,yy-3,6,"#e7f5e9"); s.text(RX+7,yy,"✓",8,GRN,anchor="middle")
        elif st=='attn': s.circle(RX+7,yy-3,6,AMB_BG,stroke="#e6cfa6"); s.text(RX+7,yy,"!",8,ORG,weight="700",anchor="middle")
        else: s.circle(RX+7,yy-3,6,"#e6f1ef"); s.circle(RX+7,yy-3,2.5,TEAL)
        s.text(RX+22,yy,f"{i+1}. {nm}",10.5,(INK if st!='ok' else "#475569"),weight=("700" if st=='attn' else "400")); yy+=27
    yy+=6; s.line(RX,yy,RX+RW,yy,"#e2e8f0"); yy+=20
    s.text(RX,yy,"7 of 9 confirmed",10.5,INK,weight="700"); s.text(RX,yy+16,"2 need your review",9.5,ORG)
    s.rect(RX,yy+26,RW,7,3,"#e6ebf3"); s.rect(RX,yy+26,RW*7/9,7,3,GRN)
    s.text(RX,yy+58,"Adjustment · automatic",9.5,MUTE,weight="600"); s.text(RX,yy+72,"5th-Year RCS · Section 5b(2)(b)",8.5,MUTE); s.text(RX,yy+84,"submission date: today",8.5,MUTE)

    X=408; CW=856; hw=(CW-40)/2; y=130
    s.rect(X,y,CW,50,10,"#fffaf2",stroke="#e6cfa6",filt="cs")
    s.text(X+18,y+21,"⚠  2 things need your attention",12,ORG,weight="700")
    s.text(X+18,y+38,"Flagged below in amber — the UA mismatch and the CA-address override.",9.5,"#8a6a3a")
    c1="UA mismatch → Rents"; c2="CA address overridden"; w2=W(c2,9,True)+24; w1=W(c1,9,True)+24
    s.rect(X+CW-18-w2,y+13,w2,22,11,"#ffffff",stroke="#e6cfa6"); s.text(X+CW-18-w2/2,y+28,c2,9,ORG,weight="600",anchor="middle")
    s.rect(X+CW-18-w2-8-w1,y+13,w1,22,11,"#ffffff",stroke="#e6cfa6"); s.text(X+CW-18-w2-8-w1/2,y+28,c1,9,ORG,weight="600",anchor="middle")
    y+=50+20

    # 1 Source documents
    y+=exhead(s,X,y,CW,1,"Source documents",'cyc')
    def upl(yy,nm,sub,flag=None):
        s.rect(X,yy,CW,46,8,"#f8fafc",stroke=CARD); s.circle(X+22,yy+23,10,"#e7f5e9"); s.text(X+22,yy+27,"✓",10,GRN,anchor="middle")
        s.text(X+42,yy+20,nm,11.5,INK,weight="700"); s.text(X+42+W(nm,11.5,True)+10,yy+20,"parsed",9.5,GRN,weight="600"); s.text(X+42,yy+35,sub,9.5,SUB)
        if flag: s.text(X+CW-16,yy+27,flag,9,ORG,weight="600",anchor="end")
    upl(y,"RCS report.pdf","→ proposed rents · appraiser · SAFMR · UA (backup)","⚠ UA differs"); upl(y+56,"2025 executed rent schedule — 92458.pdf","→ current rents · UA · unit mix · Part B · Part D")
    s.text(X,y+120,"AI parsed only the fields the package needs · re-upload either file to refresh.",9,MUTE,italic=True); y+=138

    # 2 Property
    y+=exhead(s,X,y,CW,2,"Property",'ok')
    fld(s,X+12,y+14,hw,"Property name","Gates Manor Apartments","db"); fld(s,X+28+hw,y+14,hw,"FHA / Section 8 #","IL06H121063","db")
    fld(s,X+12,y+58,hw,"Address","1135 Wilmette Ave, Wilmette IL 60091","db"); fld(s,X+28+hw,y+58,hw,"Entity type","Limited Partnership","db")
    fld(s,X+12,y+102,hw,"Ownership entity","Gates Manor Preservation, L.P.","db"); fld(s,X+28+hw,y+102,hw,"Entity address","30 Hudson Yards, 72nd Fl, NY","db"); y+=150

    # 3 Owner & signatory
    y+=exhead(s,X,y,CW,3,"Owner & signatory",'ok')
    fld(s,X+12,y+14,hw,"Owner point of contact","Claire Beatty","db"); fld(s,X+28+hw,y+14,hw,"POC phone · auto-format","(929) 618-8405","db")
    fld(s,X+12,y+58,hw,"POC email","cbeatty@related.com","db"); fld(s,X+28+hw,y+58,hw,"General Partner","Related (GP)","db")
    fld(s,X+12,y+102,hw,"Signatory — name","David Pearson","db"); fld(s,X+28+hw,y+102,hw,"Signatory — title","Vice President","db"); y+=150

    # 4 Contract admin
    y+=exhead(s,X,y,CW,4,"Contract administrator",'attn')
    fld(s,X+12,y+14,hw,"Contact","Ms. Heather Gross","db"); fld(s,X+28+hw,y+14,hw,"Position","Asset Manager","db")
    fld(s,X+12,y+58,hw,"CA organization","National Housing Compliance","db"); fld(s,X+28+hw,y+58,hw,"Salutation (auto)","Dear Ms. Gross","calc")
    fld(s,X+12,y+108,hw,"CA address","1975 Lakeside Pkwy, Ste 310","ov",attn=True,note="you changed this from the stored record"); fld(s,X+28+hw,y+108,hw,"City / State / Zip","Tucker, GA 30084-5860","db"); y+=168

    # 5 Appraiser
    y+=exhead(s,X,y,CW,5,"Appraiser",'cyc')
    fld(s,X+12,y+14,hw,"Appraiser name","Aaron M. Zabel","cyc"); fld(s,X+28+hw,y+14,hw,"Firm","Belfry Valuation","cyc")
    fld(s,X+12,y+58,hw,"Email","azabel@belfryvaluation.com","cyc"); fld(s,X+28+hw,y+58,hw,"Phone · auto-format","(708) 500-2380","cyc"); y+=106

    # 6 Rents & unit mix
    y+=exhead(s,X,y,CW,6,"Rents & unit mix",'attn')
    for nm,cx in [("Unit type",X+12),("Units",X+186),("Current",X+280),("Proposed",X+404),("Utility allowance",X+540)]: s.text(cx,y+12,nm,9.5,MUTE)
    row=y+22
    for cx,cw2,val,strong in [(X+12,150,"1BR / 1BA",False),(X+186,70,"51",False),(X+280,110,"$1,903",False),(X+404,110,"$2,725",True)]:
        s.rect(cx,row,cw2-14,30,5,("#edf6f4" if strong else "#f8fafc"),stroke=CARD); s.text(cx+10,row+20,val,11,(TEAL if strong else "#334155"),weight=("700" if strong else "400"))
    s.rect(X+540,row,304,30,5,AMB_BG,stroke="#e6cfa6"); s.text(X+550,row+20,"exec RS $33   vs   RCS $31",10.5,ORG,weight="700"); s.text(X+540+294,row+20,"using exec RS ▾",9,ORG,anchor="end")
    s.text(X+12,row+52,"+ Add unit type",10.5,PUR,weight="600"); s.text(X+CW-12,row+52,"gross rent $2,758 · increase +43% · non-revenue units → Part D",9,MUTE,italic=True,anchor="end"); y=row+70

    # 7 Items in rent (Part B)
    y+=exhead(s,X,y,CW,7,"Items in rent — HUD-92458 Part B",'ok')
    s.text(X,y+6,"Preprinted labels are check-only; dashed slots are write-ins (auto-check when filled).",9,MUTE,italic=True)
    y+=partb(s,X,y+22,CW)+22

    # 8 Owner's checklist
    y+=exhead(s,X,y,CW,8,"Owner's checklist",'ok')
    s.text(X,y+14,"15 of 17 selected",10.5,INK,weight="700"); s.rect(X+130,y+2,80,20,6,NAVY); s.text(X+170,y+16,"✓ Check all",9.5,"#fff",weight="600",anchor="middle"); s.rect(X+218,y+2,54,20,6,"#f8fafc",stroke="#cbd5e1"); s.text(X+245,y+16,"Clear",9.5,"#475569",anchor="middle")
    cA=X+12; cB=X+440
    s.text(cA,y+42,"Owner's Materials",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Signed cover letter",True),("Signed owner's checklist",True),("Scope of repair",False)]): citem(s,cA,y+60+i*18,l,o)
    s.text(cA,y+126,"RCS Materials",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Appraiser's transmittal letter",True),("Scope of work",True),("Subject description (+ photos)",True),("Subject's market area ID",True),("Neighborhood description",True),("Selection-of-comparables narrative",True)]): citem(s,cA,y+144+i*18,l,o)
    for i,(l,o) in enumerate([("Locator map (subject + comps)",True),("Rent comparability grid (per type)",True),("Adjustments & conclusions narrative",True),("Comparable profiles (+ photo)",True),("Appraiser's certification",True),("Appraiser's license copy (if temp)",False)]): citem(s,cB,y+60+i*18,l,o)
    s.text(cB,y+180,"Mandatory Market Rent Threshold",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Gross rents computation (project + SAFMR)",True),("Gross rents vs SAFMR comparison",True)]): citem(s,cB,y+198+i*18,l,o)
    y+=254

    # 9 Tenant notice
    y+=exhead(s,X,y,CW,9,"Tenant notice",'ok')
    fld(s,X+12,y+14,hw,"Current rent","$1,903","cyc"); fld(s,X+28+hw,y+14,hw,"Requested rent","$2,725","calc")
    fld(s,X+12,y+58,hw,"Sender — name","Tasha Francellno-Glenn","db"); fld(s,X+28+hw,y+58,hw,"Sender — position","Community Manager","db")
    fld(s,X+12,y+102,hw,"Comments to (mgmt) · derived","RA Management, 1135 Wilmette Ave","calc"); fld(s,X+28+hw,y+102,hw,"Copy to CA · derived","NHC, Tucker GA","calc"); y+=156

    s.line(X,y,X+CW,y,"#e2e8f0")
    s.rect(X+CW-320,y+14,150,30,7,"#ffffff",stroke="#c7d0dc"); s.text(X+CW-245,y+34,"Update database",11,"#475569",anchor="middle")
    s.rect(X+CW-160,y+14,160,30,7,NAVY); s.text(X+CW-80,y+34,"Generate package",12,"#fff",weight="700",anchor="middle")
    open("guided_full.svg","w",encoding="utf-8").write(s.out()); print("end y",y+60,"H",H)
build()
