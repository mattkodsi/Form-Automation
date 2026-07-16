# -*- coding: utf-8 -*-
from PIL import ImageFont
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; BLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c={}
def _f(sz,b):
    k=(round(sz*2),b)
    if k not in _c: _c[k]=ImageFont.truetype(BLD if b else REG,max(1,round(sz*2)))
    return _c[k]
def W(t,sz,b=False): return _f(sz,b).getlength(t)/2.0
SPEC={'—':'&#8212;','–':'&#8211;','·':'&#183;','✓':'&#10003;','◆':'&#9670;','●':'&#9679;',
      '↺':'&#8635;','↗':'&#8599;','↓':'&#8595;','▾':'&#9662;','✦':'&#10022;','⊞':'&#8862;',
      '＋':'+','✎':'&#9998;','→':'&#8594;'}
def esc(s):
    s=s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    for k,v in SPEC.items(): s=s.replace(k,v)
    return s
NAVY="#1e3a5f"; INK="#1e293b"; SUB="#64748b"; MUTE="#94a3b8"; CARD="#e6ebf3"; PAGE="#eef1f7"; LINE="#eef1f5"
PROV={'db':("#4c51bf","#f3f3fc","#dbe3ea"),'ov':("#b45309","#fdf6ec","#e3c9a3"),
      'cyc':("#0f766e","#edf6f4","#dbe3ea"),'calc':("#64748b","#eef2f6","#dbe3ea")}

class SVG:
    def __init__(s,w,h,bg=PAGE):
        s.o=[f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Segoe UI\',\'Helvetica Neue\',Helvetica,Arial,sans-serif">',
             '<defs><filter id="cs" x="-4%" y="-4%" width="108%" height="112%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1e293b" flood-opacity="0.08"/></filter>'
             '<linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16304f"/><stop offset="1" stop-color="#24476f"/></linearGradient></defs>']
        s.rect(0,0,w,h,0,bg)
    def rect(s,x,y,w,h,rx,fill,stroke=None,sw=1,dash=None,op=None,filt=False):
        a=f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if dash:a+=f' stroke-dasharray="{dash}"'
        if op is not None:a+=f' opacity="{op}"'
        if filt:a+=' filter="url(#cs)"'
        s.o.append(a+'/>')
    def line(s,x1,y1,x2,y2,st,sw=1): s.o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{st}" stroke-width="{sw}"/>')
    def circle(s,cx,cy,r,fill,stroke=None,sw=1):
        a=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        s.o.append(a+'/>')
    def path(s,d,fill="none",stroke=None,sw=1,lc=None,lj=None):
        a=f'<path d="{d}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if lc:a+=f' stroke-linecap="{lc}"'
        if lj:a+=f' stroke-linejoin="{lj}"'
        s.o.append(a+'/>')
    def text(s,x,y,t,sz,fill,weight="400",anchor="start",italic=False,letter=None):
        a=f'<text x="{x:.1f}" y="{y:.1f}" font-size="{sz}" fill="{fill}"'
        if weight!="400":a+=f' font-weight="{weight}"'
        if anchor!="start":a+=f' text-anchor="{anchor}"'
        if italic:a+=' font-style="italic"'
        if letter:a+=f' letter-spacing="{letter}"'
        s.o.append(a+f'>{esc(t)}</text>')
    def fit(s,x,y,t,sz,fill,maxw,weight="400",mins=8.0,anchor="start"):
        b=weight not in ("400","normal"); z=sz
        while z>mins and W(t,z,b)>maxw: z-=0.5
        s.text(x,y,t,round(z,1),fill,weight,anchor)
    def out(s): s.o.append('</svg>'); return "\n".join(s.o)

def field(s,x,y,w,label,value,prov,edited=False,vsize=10.5):
    acc,tint,bd=PROV[prov]
    s.text(x,y,label,10,SUB)
    if edited: s.text(x+w,y,"edited ↺",8.5,acc,weight="600",anchor="end")
    s.rect(x,y+6,w,30,6,tint,stroke=bd); s.rect(x,y+6,4,30,0,acc)
    s.fit(x+12,y+26,value,vsize,"#334155",w-18)
def chead(s,x,y,w,title,num=None,tag=None,tbg=None,tfg=None):
    if num is not None:
        s.circle(x+26,y+24,11,NAVY); s.text(x+26,y+28,str(num),10,"#fff",weight="700",anchor="middle")
        s.text(x+48,y+29,title,13,INK,weight="700")
    else:
        s.text(x+16,y+29,title,13,INK,weight="700")
    if tag:
        tw=W(tag,8.5)+18; s.rect(x+w-16-tw,y+16,tw,17,8,tbg); s.text(x+w-16-tw/2,y+28,tag,8.5,tfg,anchor="middle")
    s.line(x+16,y+40,x+w-16,y+40,LINE)
def cbox(s,x,y,on):
    if on: s.rect(x,y,12,12,2,NAVY); s.text(x+6,y+9.4,"✓",8.5,"#fff",anchor="middle")
    else: s.rect(x,y,12,12,2,"#ffffff",stroke="#b6c1d0")
def citem(s,x,yb,label,on):
    cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155")
def uitem(s,x,yb,label,on,typ):
    cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155")
    bx=x+92; s.rect(bx,yb-10,15,12,3,"#eef2f6"); s.text(bx+7,yb-0.6,typ,8,"#475569",anchor="middle")
def witem(s,x,yb,value,on,boxw=118):
    cbox(s,x,yb-10,on)
    s.rect(x+18,yb-11,boxw,15,3,"#ffffff",stroke="#c7d0dc",dash="4 3")
    if value: s.text(x+25,yb-0.6,value,9.5,"#334155")
    else: s.text(x+25,yb-0.6,"write-in…",9,"#aab4c1",italic=True)
def subdb(s,x,yb,t):
    s.text(x,yb,t,10,"#475569",weight="600"); s.text(x+W(t,10,True)+8,yb,"◆ DB",8.5,"#4c51bf")
def subpl(s,x,yb,t): s.text(x,yb,t,10,"#475569",weight="600")

# HUD-92458 Part B laid out exactly as the form (3-col grid; blanks in real positions)
EQ_GRID=[
 [("chk","Range",True),("chk","Dishwasher",False),("wi","",False)],
 [("chk","Refrigerator",True),("chk","Carpet",True),("wi","",False)],
 [("chk","Air Conditioner",False),("chk","Drapes",False),("wi","Microwave",True)],
 [("chk","Disposal",False),("wi","",False),("wi","",False)]]
UT_GRID=[
 [("fuel","Heating",True,"G"),("fuel","Hot Water",True,"G"),("fuel","Lights, etc.",False,"E")],
 [("fuel","Cooling",False,"E"),("fuel","Cooking",True,"G"),("wi","",False)]]
SV_GRID=[
 [("chk","Parking",True),("wi","",False),("chk","Nursing Care",False)],
 [("chk","Laundry",False),("wi","",False),("chk","Linen/Maid Service",False)],
 [("chk","Swimming Pool",False),("wi","",False),("wi","Elevator",True)],
 [("chk","Tennis Courts",False),("wi","",False),("wi","",False)]]
def pcell(s,x,yb,cell,colw):
    if not cell: return
    k=cell[0]
    if k=="chk": citem(s,x,yb,cell[1],cell[2])
    elif k=="fuel": uitem(s,x,yb,cell[1],cell[2],cell[3])
    elif k=="wi": witem(s,x,yb,cell[1],bool(cell[1]),boxw=colw-30)
def profile_block(s,x0,y,colw,badge=True):
    sub=subdb if badge else subpl
    sub(s,x0,y,"Equipment / furnishings"); yy=y+18
    for ri,row in enumerate(EQ_GRID):
        for ci,c in enumerate(row): pcell(s,x0+ci*colw,yy+ri*19,c,colw)
    y2=yy+len(EQ_GRID)*19+8
    sub(s,x0,y2,"Utilities  (included · fuel type)"); yy2=y2+18
    for ri,row in enumerate(UT_GRID):
        for ci,c in enumerate(row): pcell(s,x0+ci*colw,yy2+ri*19,c,colw)
    y3=yy2+len(UT_GRID)*19+8
    sub(s,x0,y3,"Services / facilities"); yy3=y3+18
    for ri,row in enumerate(SV_GRID):
        for ci,c in enumerate(row): pcell(s,x0+ci*colw,yy3+ri*19,c,colw)
    return yy3+len(SV_GRID)*19+4

# =====================================================================
def build_form():
    W,H=1720,1320; s=SVG(W,H); gap=20
    s.rect(0,0,W,76,0,"url(#hdr)")
    s.rect(24,20,38,38,9,"#ffffff",op=0.14); s.rect(35,30,16,19,2,"none",stroke="#fff",sw=1.4)
    s.line(38,36,48,36,"#fff",1.1); s.line(38,40,48,40,"#fff",1.1)
    s.text(74,34,"Renewal Package Builder",18,"#ffffff",weight="700")
    s.text(74,55,"HUD Section 8 · rent adjustment packages",11,"#c3d2e6")
    def pill(x,w,lab,active,dis=False):
        if active: s.rect(x,22,w,32,8,"#ffffff"); s.text(x+w/2,43,lab,12.5,NAVY,weight="700",anchor="middle")
        elif dis: s.rect(x,22,w,32,8,"none",stroke="#3f5f86"); s.text(x+w/2,43,lab,12,"#7f93b0",weight="600",anchor="middle")
        else: s.rect(x,22,w,32,8,"#ffffff",op=0.16); s.text(x+w/2,43,lab,12.5,"#dbe6f4",weight="600",anchor="middle")
    pill(694,72,"RCS",True); pill(772,82,"OCAF",False,True); pill(864,72,"UAF",False,True); pill(942,78,"BBRA",False,True)
    s.text(1036,35,"OCAF · UAF · BBRA",8.5,"#7f93b0"); s.text(1036,46,"coming later",8.5,"#7f93b0")
    s.rect(24,88,W-48,84,12,"#eef0fb",stroke="#4c51bf",sw=1.3)
    s.text(44,112,"PROPERTY",10.5,"#4c51bf",weight="700",letter=0.5)
    s.rect(44,120,300,38,8,"#ffffff",stroke="#c7c9ee"); s.text(58,144,"Gates Manor Apartments",14,INK,weight="600"); s.text(330,144,"▾",12,SUB,anchor="end")
    s.circle(372,126,8,"#e7f5e9"); s.text(372,130,"✓",10,"#2f7d3a",anchor="middle")
    s.text(388,123,"Stored record found",12.5,INK,weight="600")
    s.text(388,140,"last updated Mar 12, 2026 · 38 fields on file",10.5,SUB)
    s.text(388,155,"Fill loads these values into the form; Update writes your current values back.",10,"#4c51bf")
    s.rect(W-336,118,200,34,8,"#4c51bf"); s.text(W-236,140,"Fill sections from database",12,"#fff",weight="700",anchor="middle")
    s.text(W-24,112,"Manage database ↗",10.5,"#4c51bf",weight="600",anchor="end")
    s.rect(24,180,W-48,44,10,"#ffffff",stroke=CARD)
    s.text(44,207,"EACH FIELD IS TAGGED BY SOURCE",10,MUTE,weight="700",letter=0.5)
    def leg(x,prov,lab):
        acc,tint,bd=PROV[prov]; s.rect(x,196,4,14,2,acc); s.rect(x+8,196,12,14,2,tint,stroke=bd); s.text(x+26,207,lab,10.5,"#475569")
    leg(300,'db',"From database"); leg(440,'ov',"Overridden"); leg(566,'cyc',"Entered this cycle"); leg(726,'calc',"Auto-calculated")
    # slim nav rail
    s.rect(24,240,150,980,10,"#ffffff",stroke=CARD)
    s.text(38,268,"SECTIONS",9,MUTE,weight="700",letter=1)
    nav=[("1 Property",True),("2 Adjustment · auto",False),("3 Contract admin",False),("4 Owner & sign.",False),
         ("5 Appraiser",False),("6 Source docs",False),("7 Checklist",False),("8 Rent schedule",False),
         ("9 Analysis check",False),("10 Tenant notice",False)]
    for i,(lab,act) in enumerate(nav):
        yy=300+i*34; s.circle(40,yy-4,5,NAVY if act else "#cbd5e1"); s.text(52,yy,lab,10.5,(INK if act else "#475569"),weight=("600" if act else "400"))
    s.circle(40,300+10*34+6,5,NAVY); s.text(52,300+10*34+10,"Generate",10.5,NAVY,weight="700")

    CAX,CBX,CCX,CW=190,700,1210,490
    def gcard(x,y,w,num,title,tag,rows):
        tg,tb,tf=tag; h=64+len(rows)*48; s.rect(x,y,w,h,12,"#ffffff",stroke=CARD,filt=True); chead(s,x,y,w,title,num=num,tag=tg,tbg=tb,tfg=tf)
        pad=16; inner=w-2*pad; hw=(inner-16)/2
        for i,r in enumerate(rows):
            ly=y+62+i*48
            if len(r)==1: field(s,x+pad,ly,inner,*r[0])
            else:
                for j,f in enumerate(r): field(s,x+pad+(0 if j==0 else hw+16),ly,hw,*f)
        return h
    DB=("◆ from database","#f3f3fc","#4c51bf"); CY=("● this cycle","#edf6f4","#0f766e"); AU=("↺ automatic","#eef2f6",MUTE)
    def R(l,v,p,e=False): return (l,v,p,e)

    # ---------- Column A: 1,2,3,4 ----------
    ya=240
    ya+=gcard(CAX,ya,CW,1,"Property & identifiers",DB,[
        [R("Property name","Gates Manor Apartments","db"),R("FHA / Section 8 #","IL06H121063","db")],
        [R("Address","1135 Wilmette Ave, Wilmette IL 60091","db"),R("Entity type","Limited Partnership","db")],
        [R("Ownership entity","Gates Manor Preservation, L.P.","db"),R("Entity address","30 Hudson Yards, 72nd Fl, NY","db")]])+gap
    ya+=gcard(CAX,ya,CW,2,"Adjustment",AU,[
        [R("Submission date · defaults to today","July 10, 2026","cyc")],
        [R("Adjustment type · fixed","5th-Year RCS Adjustment","calc"),R("HAP citation · fixed","Section 5b(2)(b)","calc")]])+gap
    # 3 Contract administrator (custom: prefix dropdown FIRST, then name)
    Y=ya; ch3=256; s.rect(CAX,Y,CW,ch3,12,"#ffffff",stroke=CARD,filt=True); chead(s,CAX,Y,CW,"Contract administrator",num=3,tag="◆ from database",tbg="#f3f3fc",tfg="#4c51bf")
    inner=CW-32; x0=CAX+16
    field(s,x0,Y+62,inner,"CA organization","National Housing Compliance","db")
    pw=76; nx=x0+pw+12; nw=196; qx=nx+nw+12; qw=inner-pw-nw-24
    s.text(x0,Y+110,"Prefix",10,SUB); ac,ti,bd=PROV['db']; s.rect(x0,Y+116,pw,30,6,ti,stroke=bd); s.rect(x0,Y+116,4,30,0,ac); s.text(x0+12,Y+136,"Ms.",10.5,"#334155"); s.text(x0+pw-8,Y+136,"▾",10,SUB,anchor="end")
    field(s,nx,Y+110,nw,"Contact name","Heather Gross","db")
    field(s,qx,Y+110,qw,"Position","Asset Manager","db")
    field(s,x0,Y+158,(inner-16)/2,"CA address","1975 Lakeside Pkwy, Ste 310","ov",True)
    field(s,x0+(inner-16)/2+16,Y+158,(inner-16)/2,"City / State / Zip","Tucker, GA 30084-5860","db")
    field(s,x0,Y+206,inner,"Salutation · auto from prefix + last name","Dear Ms. Gross","calc")
    ya=Y+ch3+gap
    ya+=gcard(CAX,ya,CW,4,"Owner contact & signatory",DB,[
        [R("Owner point of contact","Claire Beatty","db"),R("POC phone · auto-format","(929) 618-8405","db")],
        [R("POC email","cbeatty@related.com","db"),R("General Partner","Related (GP)","db")],
        [R("Signatory — name","David Pearson","db"),R("Signatory — title","Vice President","db")]])
    colA_end=ya

    # ---------- Column B: 5,6,7,10 ----------
    yb=240
    yb+=gcard(CBX,yb,CW,5,"RCS appraiser",CY,[
        [R("Appraiser name","Aaron M. Zabel","cyc"),R("Firm","Belfry Valuation","cyc")],
        [R("Email","azabel@belfryvaluation.com","cyc"),R("Phone · auto-format","(708) 500-2380","cyc")]])+gap
    Y=yb; ch6=196; s.rect(CBX,Y,CW,ch6,12,"#ffffff",stroke=CARD,filt=True); chead(s,CBX,Y,CW,"Source documents",num=6,tag="● this cycle",tbg="#edf6f4",tfg="#0f766e")
    def upl(yy,title,sub2):
        s.rect(CBX+16,yy,CW-32,40,8,"#f8fafc",stroke="#a9b6c6",dash="5 4")
        s.path(f"M{CBX+42} {yy+27} l0 -11 M{CBX+37} {yy+20} l5 -5 l5 5",stroke=NAVY,sw=2,lc="round",lj="round")
        s.text(CBX+58,yy+19,title,11,NAVY,weight="600"); s.text(CBX+58,yy+33,sub2,9,SUB)
    upl(Y+52,"Upload RCS report (PDF)","→ proposed rents · appraiser · SAFMR · UA (backup)")
    upl(Y+100,"Upload prior executed rent schedule — HUD-92458","→ current rents · UA · unit mix · Part B · Part D")
    s.rect(CBX+16,Y+150,180,30,8,"#0f766e"); s.text(CBX+30,Y+170,"✦  Auto-fill (AI)",12,"#fff",weight="700")
    s.text(CBX+206,Y+162,"only the bare minimum is",9,SUB); s.text(CBX+206,Y+174,"parsed from PDFs; flagged",9,SUB)
    yb=Y+ch6+gap
    # 7 Checklist (faithful Appendix 9-2-2, 17 items, top-down each column)
    Y=yb; ch7=340; s.rect(CBX,Y,CW,ch7,12,"#ffffff",stroke=CARD,filt=True); chead(s,CBX,Y,CW,"Owner's checklist",num=7,tag="Appendix 9-2-2",tbg="#eef2f6",tfg=MUTE)
    s.rect(CBX+16,Y+52,98,24,6,NAVY); s.text(CBX+65,Y+68,"✓ Check all",10.5,"#fff",weight="600",anchor="middle")
    s.rect(CBX+122,Y+52,60,24,6,"#f8fafc",stroke="#cbd5e1"); s.text(CBX+152,Y+68,"Clear",10.5,"#475569",anchor="middle")
    s.text(CBX+196,Y+68,"15 of 17 selected",10,SUB,italic=True)
    cA=CBX+16; cB=CBX+256
    s.text(cA,Y+96,"Owner's Materials",10,"#4c51bf",weight="700")
    om=[("Signed cover letter",True),("Signed owner's checklist",True),("Scope of repair",False)]
    for i,(l,o) in enumerate(om): citem(s,cA,Y+114+i*18,l,o)
    s.text(cA,Y+178,"RCS Materials",10,"#4c51bf",weight="700")
    la=[("Appraiser's transmittal letter",True),("Scope of work",True),("Subject description (+ photos)",True),("Subject's market area ID",True),("Neighborhood description",True),("Selection-of-comparables narrative",True)]
    lb=[("Locator map (subject + comps)",True),("Rent comparability grid (per type)",True),("Adjustments & conclusions narrative",True),("Comparable profiles (+ photo)",True),("Appraiser's certification",True),("Appraiser's license copy (if temp)",False)]
    for i,(l,o) in enumerate(la): citem(s,cA,Y+196+i*18,l,o)
    for i,(l,o) in enumerate(lb): citem(s,cB,Y+96+i*18,l,o)
    s.text(cB,Y+96+6*18+6,"Mandatory Market Rent Threshold",10,"#4c51bf",weight="700")
    th=[("Gross rents computation (project + SAFMR)",True),("Gross rents vs SAFMR comparison",True)]
    for i,(l,o) in enumerate(th): citem(s,cB,Y+96+6*18+24+i*18,l,o)
    yb=Y+ch7+gap
    yb+=gcard(CBX,yb,CW,10,"Tenant notice",("property letterhead","#eef2f6",MUTE),[
        [R("Current rent","$1,903","cyc"),R("Requested rent","$2,725","calc")],
        [R("Sender — name","Tasha Francellno-Glenn","db"),R("Sender — position","Community Manager","db")],
        [R("Comments to (mgmt) · derived","RA Management, 1135 Wilmette Ave","calc"),R("Copy to CA · derived","NHC, Tucker GA","calc")]])
    colB_end=yb

    # ---------- Column C: 8, 9, generate summary ----------
    yc=240
    Y=yc; rh=456; s.rect(CCX,Y,CW,rh,12,"#ffffff",stroke=CARD,filt=True); chead(s,CCX,Y,CW,"Draft rent schedule",num=8,tag="HUD-92458 · Part A/B",tbg="#eef2f6",tfg=MUTE)
    cols=[("Unit type",CCX+16,118,"1BR / 1BA","db"),("Units",CCX+140,48,"51","db"),("Prior rent",CCX+196,84,"$1,903","cyc"),("Proposed",CCX+286,84,"$2,725","cyc"),("UA",CCX+378,86,"$33","cyc")]
    for nm,cx,cw,_,_ in cols: s.text(cx+4,Y+58,nm,9,MUTE)
    for nm,cx,cw,val,prov in cols:
        acc,tint,bd=PROV[prov]; s.rect(cx,Y+64,cw,28,5,tint,stroke=bd); s.rect(cx,Y+64,3,28,0,acc); s.fit(cx+10,Y+83,val,10.5,"#334155",cw-14)
    s.rect(CCX+378,Y+95,86,15,7,"#fdf0e0"); s.text(CCX+421,Y+105.5,"src exec RS · RCS $31",7.5,"#b45309",anchor="middle")
    s.text(CCX+16,Y+120,"+ Add unit type",10,"#0f766e",weight="600")
    s.text(CCX+CW-16,Y+120,"Part B — verbatim from executed schedule",8.5,MUTE,italic=True,anchor="end")
    s.text(CCX+16,Y+138,"Preprinted = check only · dashed = write-ins (auto-check when filled) · Part A up to 11 types, non-rev → Part D",8,MUTE,italic=True)
    colw=(CW-32)/3
    profile_block(s,CCX+16,Y+158,colw,badge=True)
    s.text(CCX+16,Y+rh-13,"UA source: exec RS $33 (RCS $31 differs — using exec RS)",8.5,"#b45309",italic=True)
    yc=Y+rh+gap
    Y=yc; ah=176; s.rect(CCX,Y,CW,ah,12,"#fdfaf4",stroke="#e3c9a3",filt=True)
    s.circle(CCX+26,Y+24,11,"#b45309"); s.text(CCX+26,Y+28,"9",10,"#fff",weight="700",anchor="middle"); s.text(CCX+48,Y+29,"Rent analysis check",13,INK,weight="700")
    tw=146; s.rect(CCX+CW-16-tw,Y+16,tw,17,8,"#fdf0e0"); s.text(CCX+CW-16-tw/2,Y+28,"internal — not submitted",8.5,"#b45309",anchor="middle")
    s.line(CCX+16,Y+40,CCX+CW-16,Y+40,"#f0e2cf")
    ar=[("Current GPR (mo / yr)","$97,053 / $1,164,636"),("RCS GPR (mo / yr)","$138,975 / $1,667,700"),("Increase","$822 / unit · +43.2%"),("RCS + UA vs 150% SAFMR GPR","$140,658  <  $178,245")]
    for i,(lab,val) in enumerate(ar):
        yy=Y+62+i*23; s.text(CCX+16,yy,lab,10.5,SUB); s.text(CCX+CW-16,yy,val,10.5,"#334155",anchor="end")
    s.rect(CCX+16,Y+ah-24,150,20,10,"#e7f5e9"); s.text(CCX+91,Y+ah-10,"Below 150%?  ✓ PASS",10,"#2f7d3a",weight="700",anchor="middle")
    s.text(CCX+CW-16,Y+ah-10,"SAFMR: HUD dataset · RCS matches",8.5,MUTE,italic=True,anchor="end")
    yc=Y+ah+gap
    Y=yc; gsh=120; s.rect(CCX,Y,CW,gsh,12,"#ffffff",stroke=CARD,filt=True)
    s.rect(CCX+16,Y+14,20,20,4,"#eef4fb"); s.text(CCX+26,Y+29,"⊞",12,NAVY,anchor="middle")
    s.text(CCX+46,Y+29,"This package generates 6 documents",12.5,INK,weight="700")
    s.line(CCX+16,Y+42,CCX+CW-16,Y+42,LINE)
    docs=["1  Related letterhead cover letter","2  Owner cover letter (certifications)","3  Owner's checklist (9-2-2)","4  RCS report","5  Draft rent schedule","6  Tenant notice"]
    for i,d in enumerate(docs):
        col=i//3; row=i%3; s.text(CCX+16+col*((CW-32)/2),Y+62+row*18,"✓",10,"#0f766e"); s.text(CCX+30+col*((CW-32)/2),Y+62+row*18,d,10,"#334155")
    yc=Y+gsh
    colC_end=yc

    fy=max(colA_end,colB_end,colC_end)+gap
    s.line(24,fy,W-24,fy,"#dbe1ea")
    s.rect(190,fy+14,230,42,10,"#4c51bf"); s.text(305,fy+40,"Update database with inputs",12.5,"#fff",weight="700",anchor="middle")
    s.rect(438,fy+14,190,42,10,NAVY); s.text(533,fy+40,"Generate package",13,"#fff",weight="700",anchor="middle")
    s.rect(644,fy+14,110,42,10,"#ffffff",stroke="#cbd5e1"); s.text(699,fy+40,"Save draft",12.5,"#475569",anchor="middle")
    s.text(W-24,fy+32,"Generated as review-ready drafts.",10,SUB,italic=True,anchor="end")
    open("form_v5.svg","w",encoding="utf-8").write(s.out()); print("form",W,H,"A",colA_end,"B",colB_end,"C",colC_end,"foot",fy+58)

# =====================================================================
def build_dbm():
    W,H=1600,880; s=SVG(W,H); SB="#14243b"; SBT="#c3d2e6"; SBM="#7e93b0"
    s.rect(0,0,W,64,0,"#4c51bf")
    s.text(32,34,"Property Database",18,"#ffffff",weight="700"); s.text(32,52,"Standalone now · will live inside Navigator 2.0",11,"#d7d9f5")
    s.rect(W-274,18,250,28,7,"#ffffff",op=0.16); s.text(W-256,37,"Search properties…",11,"#e6e7fb")
    s.rect(0,64,250,H-64,0,SB)
    s.text(24,98,"PORTFOLIO",10,SBM,weight="700",letter=1)
    s.rect(14,112,222,40,8,"#22467a"); s.text(30,132,"Gates Manor Apartments",12.5,"#ffffff",weight="700"); s.text(30,146,"IL06H121063 · complete",9.5,"#9db4d6")
    for name,yy,dot in [("Ravenswood Terrace",184,"#e0b23c"),("Colonial Village",222,"#e0b23c"),("Lakeside Commons",260,"#3f9a55"),("Harbor Point",298,"#e0b23c"),("Maple Court",336,"#3f9a55"),("Riverview Homes",374,"#c05050")]:
        s.text(30,yy,name,12.5,SBT); s.circle(222,yy-4,4,dot)
    s.circle(28,410,4,"#3f9a55"); s.text(38,414,"complete",9,"#8fa3c0")
    s.circle(120,410,4,"#e0b23c"); s.text(130,414,"partial",9,"#8fa3c0")
    s.circle(196,410,4,"#c05050"); s.text(206,414,"missing",9,"#8fa3c0")
    s.rect(14,H-54,222,38,8,"#ffffff",op=0.12); s.text(125,H-30,"＋ New property",12,"#dbe6f4",weight="600",anchor="middle")
    s.text(274,100,"Gates Manor Apartments",20,INK,weight="700")
    s.text(274,124,"FHA IL06H121063 · 1135 Wilmette Ave, Wilmette IL · 51 units · senior",12,SUB)
    s.rect(W-208,86,184,40,8,"#4c51bf"); s.text(W-116,111,"Save changes",13,"#fff",weight="700",anchor="middle")
    s.rect(274,150,W-298,30,8,"#eef0fb",stroke="#c7c9ee")
    s.text(290,169,"Every value carries a save date. Edit here, or update from within the form. These records feed “Fill from database” and migrate into Navigator 2.0.",10.5,"#3a3f8f")

    C1X,C2X,C3X,CW=274,716,1158,422; gap=20
    def dhead(x,y,w,title,note=None):
        s.rect(x,y,w,34,12,"#f4f6fb"); s.rect(x,y+17,w,17,0,"#f4f6fb"); s.text(x+16,y+22,title,12.5,INK,weight="700")
        if note: s.text(x+w-16,y+22,note,9,MUTE,italic=True,anchor="end")
        s.line(x+16,y+40,x+w-16,y+40,LINE)
    def drow(x,y,w,lab,val,dt,lw=158):
        s.text(x,y,lab,11,SUB); s.fit(x+lw,y,val,11,INK,w-lw-70); s.text(x+w-14,y,dt+" ✎",9,"#a9b4c3",anchor="end")
    def dcard(x,y,w,title,rows,lw=158):
        n=len(rows); h=80+(n-1)*28; s.rect(x,y,w,h,12,"#ffffff",stroke=CARD,filt=True); dhead(x,y,w,title)
        for i,(lab,val,dt) in enumerate(rows):
            ry=y+60+i*28; drow(x+16,ry,w-32,lab,val,dt,lw)
            if i<n-1: s.line(x+16,ry+9,x+w-16,ry+9,LINE)
        return h
    # Col 1
    y=200
    y+=dcard(C1X,y,CW,"Identifiers & entity",[("Property name","Gates Manor Apartments","Mar '26"),("FHA / Section 8 #","IL06H121063","Mar '26"),("Address","1135 Wilmette Ave","Mar '26"),("Entity type","Limited Partnership","Mar '26"),("Ownership entity","Gates Manor Preservation, L.P.","Mar '26"),("Entity address","30 Hudson Yards, NY","Mar '26")])+gap
    y+=dcard(C1X,y,CW,"Contacts",[("Contract admin","National Housing Compliance","Mar '26"),("CA contact (prefix + name)","Ms. Heather Gross","Mar '26"),("CA position","Asset Manager","Mar '26"),("CA address","1975 Lakeside Pkwy, Tucker GA","Mar '26"),("Owner contact","Claire Beatty","Mar '26"),("Owner phone · auto-format","(929) 618-8405","Mar '26"),("Appraiser name","Aaron Zabel","Jan '26"),("Appraiser firm","Belfry Valuation","Jan '26")])
    col1_end=y
    # Col 2
    y=200
    y+=dcard(C2X,y,CW,"Signatories & sender",[("General Partner","Related (GP)","Mar '26"),("Signatory — name","David Pearson","Mar '26"),("Signatory — title","Vice President","Mar '26"),("Notice sender — name","Tasha Francellno-Glenn","Feb '26"),("Notice sender — position","Community Manager","Feb '26")])+gap
    Y=y; fh=210; s.rect(C2X,Y,CW,fh,12,"#ffffff",stroke=CARD,filt=True); dhead(C2X,Y,CW,"Rents & prior schedule")
    drow(C2X+16,Y+60,CW-32,"SAFMR (1BR, 60091) · HUD","$2,330","Feb '26"); s.line(C2X+16,Y+69,C2X+CW-16,Y+69,LINE)
    drow(C2X+16,Y+88,CW-32,"150% SAFMR · computed","$3,495","Feb '26")
    s.text(C2X+16,Y+118,"Prior executed rent schedule — 2025",10.5,"#4c51bf",weight="700")
    for nm,cx,cw,val in [("Unit type",C2X+16,116,"1BR / 1BA"),("Units",C2X+138,48,"51"),("Contract rent",C2X+192,100,"$1,903"),("UA",C2X+298,56,"$33")]:
        s.text(cx+4,Y+138,nm,9,MUTE); s.rect(cx,Y+144,cw,26,5,"#f8fafc",stroke="#e2e8f0"); s.fit(cx+8,Y+162,val,10.5,"#334155",cw-12)
    s.text(C2X+16,Y+fh-12,"Current rents & UA from executed schedule; RCS UA = backup. SAFMR from HUD.",8.5,MUTE,italic=True)
    y=Y+fh+gap
    y+=dcard(C2X,y,CW,"Unit mix & building",[("Revenue unit types","1BR / 1BA — 51 · 650 sf","Jan '26"),("Non-revenue (Part D)","none on file","Jan '26"),("Building","5-story · elevator","Jan '26"),("Year built","1976 (renov. 2016)","Jan '26")])
    col2_end=y
    # Col 3
    y=200
    Y=y; ph2=330; s.rect(C3X,Y,CW,ph2,12,"#ffffff",stroke=CARD,filt=True); dhead(C3X,Y,CW,"Equipment · utilities · services",note="verbatim · incl. write-ins")
    colw=(CW-32)/3; profile_block(s,C3X+16,Y+58,colw,badge=False)
    s.text(C3X+16,Y+ph2-12,"HUD-92458 Part B — feeds the draft rent schedule on Fill from database.",8.5,MUTE,italic=True)
    y=Y+ph2+gap
    Y=y; gh=214; s.rect(C3X,Y,CW,gh,12,"#ffffff",stroke=CARD,filt=True); dhead(C3X,Y,CW,"Stored assets")
    s.text(C3X+16,Y+58,"Property letterhead  (tenant notice)",10.5,"#475569",weight="600")
    s.rect(C3X+16,Y+66,CW-32,44,8,"#f8fafc",stroke="#e2e8f0"); s.rect(C3X+28,Y+76,24,24,3,"#eef0fb"); s.text(C3X+40,Y+92,"◆",11,"#4c51bf",anchor="middle")
    s.text(C3X+62,Y+84,"gates-manor-letterhead.png",10.5,INK); s.text(C3X+62,Y+99,"uploaded Jan 14, 2026",9,MUTE); s.text(C3X+CW-26,Y+92,"Replace",10,"#4c51bf",weight="600",anchor="end")
    s.text(C3X+16,Y+132,"Prior executed rent schedules",10.5,"#475569",weight="600")
    for lab,rt,yy in [("2025 executed rent schedule","uploaded Apr 2025 ↓",Y+140),("2024 executed rent schedule","uploaded Apr 2024 ↓",Y+172)]:
        s.rect(C3X+16,yy,CW-32,26,7,"#f8fafc",stroke="#e2e8f0"); s.text(C3X+28,yy+18,lab,10.5,INK); s.text(C3X+CW-26,yy+18,rt,9,MUTE,anchor="end")
    y=Y+gh
    col3_end=y
    open("dbm_v5.svg","w",encoding="utf-8").write(s.out()); print("dbm",W,H,"c1",col1_end,"c2",col2_end,"c3",col3_end)

build_form(); build_dbm()
