# -*- coding: utf-8 -*-
from PIL import ImageFont
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; BLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c={}
def _f(sz,b):
    k=(round(sz*2),b)
    if k not in _c: _c[k]=ImageFont.truetype(BLD if b else REG,max(1,round(sz*2)))
    return _c[k]
def W(t,sz,b=False): return _f(sz,b).getlength(t)/2.0
SPEC={'—':'&#8212;','·':'&#183;','✓':'&#10003;','→':'&#8594;','▾':'&#9662;','●':'&#9679;','↺':'&#8635;','⚠':'&#9888;','▮':'&#9646;','▯':'&#9647;'}
def esc(s):
    s=s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    for k,v in SPEC.items(): s=s.replace(k,v)
    return s
NAVY="#1e3a5f"; INK="#1e293b"; SUB="#64748b"; MUTE="#94a3b8"; CARD="#e6ebf3"; PAGE="#f4f6fa"; HAIR="#eef1f6"
PUR="#4c51bf"; TEAL="#0f766e"; ORG="#b45309"; GRN="#2f7d3a"; AMB_BG="#fdf3e5"; CALC="#2563eb"; GRAY="#9aa4b2"
PROV={'db':("#4c51bf","#f3f3fc","#dfe3f5"),'cyc':("#0f766e","#e9f4f1","#cfe6df"),'ov':("#b45309","#fdf4e8","#ecd6b3"),'calc':("#2563eb","#eef4fd","#cfe0fb"),'raw':("#9aa4b2","#f1f3f6","#dde2e9")}
class SVG:
    def __init__(s,w,h,bg=PAGE):
        s.o=[f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Segoe UI\',Helvetica,Arial,sans-serif">',
             '<defs><filter id="cs" x="-4%" y="-6%" width="108%" height="118%"><feDropShadow dx="0" dy="1.5" stdDeviation="3.5" flood-color="#1e293b" flood-opacity="0.07"/></filter></defs>']
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

def fbox(s,x,y,w,label,value,src='db',revert=False,bold=False):
    acc,tint,bd=PROV[src]
    s.text(x,y,label,9.5,SUB)
    if revert: s.text(x+w,y,"↺ revert",8,ORG,weight="700",anchor="end")
    s.rect(x,y+5,w,27,5,tint,stroke=bd); s.rect(x,y+5,4,27,0,acc)
    s.fit(x+13,y+23,value,11,INK,w-20,weight=("700" if bold else "400"))
def colbody(s,x,by,w,left,right):
    lx=x+22; rx=x+w*0.5+10; colw=w*0.5-40
    for i,f in enumerate(left): fbox(s,lx,by+22+i*42,colw,*f)
    for i,f in enumerate(right): fbox(s,rx,by+22+i*42,colw,*f)
    return 22+max(len(left),len(right))*42+8
def seccard(s,x,y,w,bodyh,num,title,status):
    h=42+bodyh; s.rect(x,y,w,h,10,"#ffffff",stroke=CARD,filt="cs")
    s.rect(x,y,w,42,10,"#fafbfd"); s.rect(x,y+22,w,20,0,"#fafbfd")
    s.circle(x+24,y+21,10,NAVY); s.text(x+24,y+24.5,str(num),9.5,"#fff",weight="700",anchor="middle")
    s.text(x+44,y+25,title,13,INK,weight="700")
    if status=='attn': s.rect(x+w-172,y+12,110,18,9,AMB_BG,stroke="#e6cfa6"); s.text(x+w-117,y+24.5,"⚠ 1 to review",8.5,ORG,weight="700",anchor="middle")
    elif status=='cyc': s.rect(x+w-160,y+12,98,18,9,"#e6f1ef"); s.text(x+w-111,y+24.5,"this cycle",8.5,TEAL,weight="700",anchor="middle")
    elif status=='ok': s.rect(x+w-152,y+12,90,18,9,"#e7f5e9"); s.text(x+w-107,y+24.5,"confirmed",8.5,GRN,weight="700",anchor="middle")
    s.rect(x+w-40,y+11,22,20,5,"#eef1f7",stroke=CARD); s.text(x+w-29,y+25,"▾",10,SUB,anchor="middle")
    s.line(x,y+42,x+w,y+42,HAIR); return y+42,h
def cbox(s,x,y,on):
    if on: s.rect(x,y,12,12,2,NAVY); s.text(x+6,y+9.4,"✓",8.5,"#fff",anchor="middle")
    else: s.rect(x,y,12,12,2,"#ffffff",stroke="#b6c1d0")
def citem(s,x,yb,label,on): cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155")
def uitem(s,x,yb,label,on,typ):
    cbox(s,x,yb-10,on); s.text(x+18,yb,label,10,"#334155"); bx=x+112
    s.rect(bx,yb-10,15,12,3,"#eef2f6"); s.text(bx+7,yb-0.6,typ,8,"#475569",anchor="middle")
def witem(s,x,yb,val,bw=150):
    cbox(s,x,yb-10,bool(val)); s.rect(x+18,yb-11,bw,15,3,"#ffffff",stroke="#c7d0dc",dash="4 3")
    s.text(x+25,yb-0.6,(val if val else "write-in…"),9.5,("#334155" if val else "#aab4c1"))
EQ=[[("chk","Range",True),("chk","Dishwasher",False),("wi","Microwave")],[("chk","Refrigerator",True),("chk","Carpet",True),("wi","")],[("chk","Air Conditioner",False),("chk","Drapes",False),("wi","")],[("chk","Disposal",False),("wi",""),("wi","")]]
UT=[[("fuel","Heating",True,"G"),("fuel","Hot Water",True,"G"),("fuel","Lights, etc.",False,"E")],[("fuel","Cooling",False,"E"),("fuel","Cooking",True,"G"),("wi","")]]
SV=[[("chk","Parking",True),("wi",""),("chk","Nursing Care",False)],[("chk","Laundry",False),("wi",""),("chk","Linen/Maid Service",False)],[("chk","Swimming Pool",False),("wi",""),("wi","Elevator")],[("chk","Tennis Courts",False),("wi",""),("wi","")]]
def pc(s,x,yb,c,cw):
    if c[0]=="chk": citem(s,x,yb,c[1],c[2])
    elif c[0]=="fuel": uitem(s,x,yb,c[1],c[2],c[3])
    elif c[0]=="wi": witem(s,x,yb,c[1],bw=cw-30)
def partb(s,x,y,w):
    cw=(w-16)/3; y0=y
    def grp(t,g,yy):
        s.text(x,yy,t,9.5,"#475569",weight="600")
        for ri,row in enumerate(g):
            for ci,c in enumerate(row): pc(s,x+ci*cw,yy+17+ri*19,c,cw)
        return yy+17+len(g)*19+8
    y=grp("Equipment / furnishings",EQ,y0); y=grp("Utilities  (included · fuel type)",UT,y); y=grp("Services / facilities",SV,y)
    return y-y0

def build():
    Wd,H=1440,2380; s=SVG(Wd,H)
    s.rect(0,0,Wd,44,0,NAVY)
    s.text(24,28,"Renewal Package Builder",14.5,"#ffffff",weight="700"); s.text(252,28,"HUD Section 8 · RCS",10,"#9fb4d0")
    s.text(Wd-24,28,"Gates Manor Apartments · RCS 5th-year renewal",10,"#9fb4d0",anchor="end")
    by=56; bh=212
    ax,aw=24,636; s.rect(ax,by,aw,bh,11,"#ffffff",stroke=CARD,filt="cs")
    s.text(ax+22,by+26,"AFFORDABILITY PROOF",9.5,MUTE,weight="700")
    s.text(ax+22,by+45,"Proposed rents clear the 150% SAFMR ceiling",12.5,INK,weight="700")
    gx,gw,gy=ax+22,400,by+70
    s.text(gx,gy-4,"Monthly gross rent potential (rent + UA)",8.5,SUB)
    cf,pf=98736/178245,140658/178245
    s.rect(gx,gy+6,gw,16,8,"#e9edf3"); s.rect(gx,gy+6,gw*cf,16,0,GRN); s.rect(gx+gw*cf,gy+6,gw*(pf-cf),16,0,"#79c088")
    s.line(gx+gw,gy+2,gx+gw,gy+26,ORG,2)
    s.text(gx+gw*cf,gy+36,"$98,736",8.5,GRN,weight="700",anchor="middle"); s.text(gx+gw*cf,gy+46,"current",8,SUB,anchor="middle")
    s.text(gx+gw*pf,gy+36,"$140,658",8.5,INK,weight="700",anchor="middle"); s.text(gx+gw*pf,gy+46,"proposed",8,SUB,anchor="middle")
    s.text(gx+gw,gy+36,"$178,245",8.5,ORG,weight="700",anchor="end"); s.text(gx+gw,gy+46,"150% ceiling",8,ORG,anchor="end")
    s.text(gx+gw,gy+56,"from HUD SAFMR · RCS differs",7.5,ORG,anchor="end")
    s.rect(ax+aw-138,by+64,116,44,8,"#e7f5e9"); s.text(ax+aw-80,by+83,"✓ PASS",13,GRN,weight="700",anchor="middle"); s.text(ax+aw-80,by+99,"$37,587 headroom",8,GRN,anchor="middle")
    s.line(ax+22,by+140,ax+aw-22,by+140,HAIR)
    s.text(ax+22,by+158,"RCS LIFT vs current rent roll",9,MUTE,weight="700")
    for i,(v,l) in enumerate([("+43%","increase"),("+$822 / unit","per month"),("+$41,922 / mo","portfolio"),("+$503K / yr","annualized")]):
        lx=ax+22+i*148; s.text(lx,by+182,v,13,GRN,weight="700"); s.text(lx,by+197,l,8,SUB)
    bx,bw=672,402; s.rect(bx,by,bw,bh,11,"#ffffff",stroke=CARD,filt="cs")
    s.text(bx+18,by+26,"CROSS-DOCUMENT CHECKS",9.5,MUTE,weight="700"); s.text(bx+bw-18,by+26,"kills recycled-file errors",8,MUTE,italic=True,anchor="end")
    chk=[("Property name","identical on both uploads & record",True),("FHA / Section 8 #","matches the stored record",True),("Signatory (Part H)","David Pearson on prior & new rent schedule",True),("Utility allowance","exec schedule $33 vs RCS $31 — using exec",False),("SAFMR (150% ceiling)","HUD $2,330 vs RCS $2,290 — using HUD",False)]
    for i,(a,b,ok) in enumerate(chk):
        yy=by+52+i*31
        if ok: s.circle(bx+26,yy,8,"#e7f5e9"); s.text(bx+26,yy+3.5,"✓",8.5,GRN,anchor="middle")
        else: s.circle(bx+26,yy,8,AMB_BG,stroke="#e6cfa6"); s.text(bx+26,yy+3,"⚠",8,ORG,anchor="middle")
        s.text(bx+42,yy-1,a,10.5,INK,weight="600"); s.text(bx+42,yy+12,b,9,(SUB if ok else ORG))
    cx,cwd=1086,330; s.rect(cx,by,cwd,bh,11,"#ffffff",stroke=CARD,filt="cs")
    s.text(cx+18,by+26,"THIS PACKAGE",9.5,MUTE,weight="700")
    s.text(cx+18,by+46,"2 sources parsed",10.5,INK,weight="700"); s.text(cx+18,by+60,"RCS report · prior executed rent schedule",8.5,SUB)
    s.line(cx+18,by+72,cx+cwd-18,by+72,HAIR)
    s.text(cx+18,by+90,"Generates 6 review-ready drafts",10.5,INK,weight="700")
    for i,d in enumerate(["Cover letter (CA)","Owner cover letter","Owner's checklist","RCS report","Draft rent schedule","Tenant notice"]):
        col=i//3; r=i%3; s.text(cx+18+col*158,by+108+r*22,"✓",9,TEAL); s.text(cx+30+col*158,by+108+r*22,d,9,"#334155")
    s.rect(cx+18,by+bh-32,cwd-36,22,6,"#eef0fb"); s.text(cx+cwd/2,by+bh-17,"On generate → writes back to database, stamped today",8,PUR,weight="600",anchor="middle")

    RX=24; RW=200; ry=by+bh+34; s.line(240,by+bh+18,240,H-24,"#e4e8ee")
    s.text(RX,ry,"SECTIONS",9.5,MUTE,weight="700")
    items=[("Source documents","cyc"),("Property","ok"),("Point of contact & signatory","ok"),("Contract admin","attn"),("Appraiser","ok"),("Rents & unit mix","attn"),("Items in rent (Part B)","ok"),("Owner's checklist","ok"),("Tenant notice","ok")]
    yy=ry+22
    for i,(nm,st) in enumerate(items):
        if st=='ok': s.circle(RX+7,yy-3,6,"#e7f5e9"); s.text(RX+7,yy,"✓",8,GRN,anchor="middle")
        elif st=='attn': s.circle(RX+7,yy-3,6,AMB_BG,stroke="#e6cfa6"); s.text(RX+7,yy,"!",8,ORG,weight="700",anchor="middle")
        else: s.circle(RX+7,yy-3,6,"#e6f1ef"); s.circle(RX+7,yy-3,2.5,TEAL)
        s.fit(RX+22,yy,f"{i+1}. {nm}",10,(INK if st!='ok' else "#475569"),RW-24,weight=("700" if st=='attn' else "400")); yy+=25
    yy+=6; s.line(RX,yy,RX+RW,yy,"#e2e8f0"); yy+=18
    s.text(RX,yy,"7 of 9 confirmed",10.5,INK,weight="700"); s.text(RX,yy+15,"2 need your review",9.5,ORG)
    s.rect(RX,yy+24,RW,6,3,"#e6ebf3"); s.rect(RX,yy+24,RW*7/9,6,3,GRN)
    yy+=52; s.line(RX,yy,RX+RW,yy,"#e2e8f0"); yy+=18; s.text(RX,yy,"SOURCE KEY",9,MUTE,weight="700")
    for i,(lab,c) in enumerate([("database (on file)",PUR),("this cycle (upload)",TEAL),("overridden",ORG),("auto-calculated",CALC),("new — not yet saved",GRAY)]):
        s.rect(RX,yy+9+i*17-6,10,10,2,PROV[['db','cyc','ov','calc','raw'][i]][1],stroke=PROV[['db','cyc','ov','calc','raw'][i]][2]); s.rect(RX,yy+9+i*17-6,3,10,0,c); s.text(RX+18,yy+9+i*17+2,lab,9,"#475569")

    X=272; CW=1000; y=by+bh+30; G=14
    s.rect(X,y,CW,40,9,"#fffaf2",stroke="#e6cfa6",filt="cs")
    s.text(X+16,y+17,"⚠  2 things need your attention",11.5,ORG,weight="700")
    s.text(X+16,y+32,"Flagged in amber below — the UA mismatch (Rents) and the CA-address override.",9,"#8a6a3a"); y+=40+G
    # 1 source documents (parse + replace)
    b,h=seccard(s,X,y,CW,130,1,"Source documents",'cyc')
    def upl(yy,nm,sub,flag=None):
        s.rect(X+16,yy,CW-32,38,7,"#f8fafc",stroke=CARD); s.circle(X+34,yy+19,8,"#e7f5e9"); s.text(X+34,yy+22.5,"✓",8.5,GRN,anchor="middle")
        s.text(X+50,yy+16,nm,10.5,INK,weight="700"); s.text(X+50+W(nm,10.5,True)+8,yy+16,"parsed",8.5,GRN,weight="600"); s.text(X+50,yy+30,sub,8.5,SUB)
        if flag: s.text(X+50+W(sub,8.5)+14,yy+30,flag,8.5,ORG,weight="600")
        s.rect(X+CW-104,yy+9,76,20,5,"#ffffff",stroke="#c7d0dc"); s.text(X+CW-66,yy+22,"Replace",9,"#475569",anchor="middle")
    upl(b+6,"RCS report.pdf","→ proposed rents · appraiser · SAFMR · UA (backup)","⚠ UA differs"); upl(b+48,"2025 executed rent schedule.pdf","→ current rents · UA · unit mix · Part B · Part D")
    s.rect(X+16,b+94,150,26,6,TEAL); s.text(X+91,b+111,"↺  Re-parse files",9.5,"#fff",weight="700",anchor="middle")
    s.text(X+180,b+104,"Extracted 18 fields · 1 conflict.",9,"#334155",weight="600"); s.text(X+180,b+117,"Re-run after you replace a file.",8.5,MUTE); y+=h+G
    # 2 property
    b,h=seccard(s,X,y,CW,156,2,"Property",'ok')
    colbody(s,X,b,CW,[("Property name","Gates Manor Apartments","db"),("Address","1135 Wilmette Ave, Wilmette IL 60091","db"),("FHA / Section 8 #","IL06H121063","db")],[("Ownership entity","Gates Manor Preservation, L.P.","db"),("Entity type","Limited Partnership","db"),("Entity address","30 Hudson Yards, NY","db")]); y+=h+G
    # 3 poc
    b,h=seccard(s,X,y,CW,156,3,"Point of contact & signatory",'ok')
    colbody(s,X,b,CW,[("Point of contact","Claire Beatty","db"),("Email","cbeatty@related.com","db"),("Phone","(929) 618-8405","db")],[("General Partner","Related (GP)","db"),("Signatory","David Pearson","db"),("Signatory title","Vice President","db")]); y+=h+G
    # 4 contract admin
    b,h=seccard(s,X,y,CW,156,4,"Contract administrator",'attn')
    lx=X+22; rx=X+CW*0.5+10; colw=CW*0.5-40
    fbox(s,lx,b+22,colw,"CA organization","National Housing Compliance","db")
    s.text(lx,b+64,"Name  (prefix + name)",9.5,SUB)
    ac,ti,bd=PROV['db']; s.rect(lx,b+69,colw,27,5,ti,stroke=bd); s.rect(lx,b+69,4,27,0,ac)
    s.rect(lx+12,b+74,52,17,4,"#ffffff",stroke=bd); s.text(lx+20,b+86,"Ms.",9.5,INK); s.text(lx+56,b+86,"▾",8,SUB)
    s.line(lx+70,b+72,lx+70,b+93,bd); s.text(lx+80,b+87,"Heather Gross",11,INK)
    fbox(s,lx,b+106,colw,"Position","Asset Manager","db")
    s.text(rx,b+22,"CA address",9.5,SUB); s.text(rx+W("CA address",9.5)+8,b+22,"· changed from stored record",8,ORG,italic=True); s.text(rx+colw,b+22,"↺ revert",8,ORG,weight="700",anchor="end")
    oa,ot,ob=PROV['ov']; s.rect(rx,b+27,colw,27,5,ot,stroke=ob); s.rect(rx,b+27,4,27,0,oa); s.fit(rx+13,b+45,"1975 Lakeside Pkwy, Ste 310",11,INK,colw-20)
    fbox(s,rx,b+64,colw,"City / State / Zip","Tucker, GA 30084-5860","db"); y+=h+G
    # 5 appraiser
    b,h=seccard(s,X,y,CW,114,5,"Appraiser",'cyc')
    colbody(s,X,b,CW,[("Appraisal company","Belfry Valuation","cyc"),("Appraiser name","Aaron M. Zabel","cyc")],[("Email","azabel@belfryvaluation.com","cyc"),("Phone","(708) 500-2380","cyc")]); y+=h+G
    # 6 rents
    b,h=seccard(s,X,y,CW,116,6,"Rents & unit mix",'attn')
    for nm,cxx in [("Unit type",X+22),("Units",X+200),("Current",X+290),("Proposed",X+410),("Utility allowance",X+540)]: s.text(cxx,b+18,nm,9.5,MUTE)
    row=b+26
    for cxx,cw2,val,src,bold in [(X+22,150,"1BR / 1BA",'db',False),(X+200,66,"51",'db',False),(X+290,104,"$1,903",'cyc',False),(X+410,104,"$2,725",'cyc',True),(X+540,96,"$33 ▾",'ov',False)]:
        acc,tint,bd=PROV[src]; s.rect(cxx,row,cw2-12,28,5,tint,stroke=bd); s.rect(cxx,row,4,28,0,acc); s.fit(cxx+11,row+19,val,11,(acc if bold else INK),cw2-22,weight=("700" if bold else "400"))
    s.text(X+650,row+13,"⚠ Utility allowance — using the executed schedule ($33).",9,ORG,weight="600")
    s.text(X+650,row+27,"RCS report shows $31. Click the cell to switch source.",8.5,SUB)
    s.text(X+22,row+52,"+ Add unit type",10.5,PUR,weight="600"); s.text(X+CW-22,row+52,"gross rent $2,758 · non-revenue units → Part D",9,MUTE,italic=True,anchor="end"); y+=h+G
    # 7 part b
    b,h=seccard(s,X,y,CW,300,7,"Items included in rent (Part B)",'ok')
    s.text(X+22,b+16,"Preprinted labels check-only; dashed slots are write-ins (auto-check when filled).",9,MUTE,italic=True); partb(s,X+22,b+34,CW-44); y+=h+G
    # 8 checklist
    b,h=seccard(s,X,y,CW,250,8,"Owner's checklist",'ok')
    s.text(X+22,b+22,"15 of 17 selected",10.5,INK,weight="700"); s.rect(X+142,b+10,74,18,6,NAVY); s.text(X+179,b+23,"✓ Check all",9,"#fff",weight="600",anchor="middle"); s.rect(X+222,b+10,48,18,6,"#f8fafc",stroke="#cbd5e1"); s.text(X+246,b+23,"Clear",9,"#475569",anchor="middle")
    cA=X+22; cB=X+534
    s.text(cA,b+48,"Owner's Materials",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Signed cover letter",True),("Signed owner's checklist",True),("Scope of repair",False)]): citem(s,cA,b+65+i*17,l,o)
    s.text(cA,b+126,"RCS Materials",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Appraiser's transmittal letter",True),("Scope of work",True),("Subject description (+ photos)",True),("Subject's market area ID",True),("Neighborhood description",True),("Selection-of-comparables narrative",True)]): citem(s,cA,b+143+i*17,l,o)
    for i,(l,o) in enumerate([("Locator map (subject + comps)",True),("Rent comparability grid (per type)",True),("Adjustments & conclusions narrative",True),("Comparable profiles (+ photo)",True),("Appraiser's certification",True),("Appraiser's license copy (if temp)",False)]): citem(s,cB,b+65+i*17,l,o)
    s.text(cB,b+173,"Mandatory Market Rent Threshold",9.5,PUR,weight="700")
    for i,(l,o) in enumerate([("Gross rents computation (project + SAFMR)",True),("Gross rents vs SAFMR comparison",True)]): citem(s,cB,b+190+i*17,l,o)
    y+=h+G
    # 9 tenant
    b,h=seccard(s,X,y,CW,74,9,"Tenant notice",'ok')
    tw=(CW-44)/3
    fbox(s,X+22,b+24,tw-16,"Sender — name","Tasha Francellno-Glenn","db"); fbox(s,X+22+tw,b+24,tw-16,"Sender — title","Community Manager","db"); fbox(s,X+22+2*tw,b+24,tw-16,"Management address","1135 Wilmette Ave","db"); y+=h+G
    s.rect(X+CW-160,y+4,160,30,7,NAVY); s.text(X+CW-80,y+24,"Generate package",12,"#fff",weight="700",anchor="middle")
    s.rect(X+CW-160-10-142,y+4,142,30,7,"#ffffff",stroke="#c7d0dc"); s.text(X+CW-160-10-71,y+24,"Update database",10.5,"#475569",anchor="middle")
    open("guided_v6.svg","w",encoding="utf-8").write(s.out()); print("end y",y+44,"H",H)
build()
