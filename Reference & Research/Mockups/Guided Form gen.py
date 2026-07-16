# -*- coding: utf-8 -*-
from PIL import ImageFont
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; BLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c={}
def _f(sz,b):
    k=(round(sz*2),b)
    if k not in _c: _c[k]=ImageFont.truetype(BLD if b else REG,max(1,round(sz*2)))
    return _c[k]
def W(t,sz,b=False): return _f(sz,b).getlength(t)/2.0
SPEC={'—':'&#8212;','·':'&#183;','✓':'&#10003;','→':'&#8594;','▾':'&#9662;','●':'&#9679;','✎':'&#9998;','⚠':'&#9888;','↑':'&#8593;'}
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
    def path(s,d,fill="none",stroke=None,sw=1,lc=None,lj=None):
        a=f'<path d="{d}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if lc:a+=f' stroke-linecap="{lc}"'
        if lj:a+=f' stroke-linejoin="{lj}"'
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
    s.text(x+w,y,(word if not attn else "review"),8.5,(acc if not attn else ORG),weight=("400" if not attn else "700"),anchor="end")
    if note: s.text(x,y+33,note,8.5,ORG,italic=True)

def exhead(s,x,y,w,num,title,status=None):
    s.circle(x+9,y+9,9,NAVY); s.text(x+9,y+12.5,str(num),9,"#fff",weight="700",anchor="middle")
    s.text(x+28,y+13,title,13.5,INK,weight="700")
    if status=='attn':
        s.rect(x+w-104,y+1,104,18,9,AMB_BG,stroke="#e6cfa6"); s.text(x+w-52,y+14,"⚠ 1 to review",8.5,ORG,weight="700",anchor="middle")
    elif status=='cyc':
        s.rect(x+w-92,y+1,92,18,9,"#e6f1ef"); s.text(x+w-46,y+14,"this cycle",8.5,TEAL,weight="700",anchor="middle")
    s.line(x,y+28,x+w,y+28,"#e2e8f0")
    return 42

def collapsed(s,x,y,w,num,title,summary,tag=None,tagc=GRN):
    s.rect(x,y,w,40,9,"#ffffff",stroke=CARD,filt="cs")
    s.circle(x+22,y+20,9,"#e7f5e9"); s.text(x+22,y+23.5,"✓",9.5,GRN,anchor="middle")
    s.text(x+42,y+17,f"{num} · {title}",11.5,INK,weight="700")
    s.fit(x+42,y+31,summary,9.5,SUB,w-260)
    s.text(x+w-52,y+24,"Edit ✎",10,PUR,weight="600",anchor="end")
    if tag: s.rect(x+w-190,y+12,74,16,8,"#eef2f6"); s.text(x+w-153,y+23.5,tag,8,tagc,weight="700",anchor="middle")
    return 40

def build():
    Wd,H=1440,1190; s=SVG(Wd,H)
    # ---- app header ----
    s.rect(0,0,Wd,52,0,NAVY)
    s.text(24,32,"Renewal Package Builder",15,"#ffffff",weight="700")
    s.text(258,32,"HUD Section 8 · RCS",10.5,"#9fb4d0")
    s.text(Wd-24,24,"RCS 5th-year renewal",9.5,"#9fb4d0",anchor="end"); s.text(Wd-24,38,"drafts only · nothing auto-submitted",9.5,"#9fb4d0",anchor="end")
    # ---- sticky action bar ----
    s.rect(0,52,Wd,54,0,"#ffffff",filt="bar")
    s.text(24,80,"Reviewing — Gates Manor Apartments",13.5,INK,weight="700")
    s.text(24,96,"record loaded · confirm what's flagged, then generate",9.5,SUB)
    # right cluster
    gx=Wd-24
    s.rect(gx-168,68,168,30,7,NAVY); s.text(gx-84,88,"Generate package",12,"#fff",weight="700",anchor="middle")
    s.rect(gx-168-12-150,68,150,30,7,"#ffffff",stroke="#c7d0dc"); s.text(gx-168-12-75,88,"Update database",11,"#475569",anchor="middle")
    cpx=gx-168-12-150-16
    chip="150% SAFMR   ✓ PASS   ·   $140,658 < $178,245"; cw=W(chip,10.5,True)+28
    s.rect(cpx-cw,70,cw,26,13,"#e7f5e9"); s.text(cpx-cw/2,87,chip,10.5,GRN,weight="700",anchor="middle")

    # ---- left section rail ----
    RX=24; RW=208; ry=130
    s.text(RX,ry,"SECTIONS",9.5,MUTE,weight="700")
    items=[("Source documents","cyc"),("Property","ok"),("Owner & signatory","ok"),("Contract admin","attn"),("Appraiser","ok"),("Rents & unit mix","attn"),("Items in rent (Part B)","ok"),("Owner's checklist","ok"),("Tenant notice","ok")]
    yy=ry+22
    for i,(nm,st) in enumerate(items):
        c={'ok':GRN,'attn':ORG,'cyc':TEAL}[st]
        if st=='ok': s.circle(RX+7,yy-3,6,"#e7f5e9"); s.text(RX+7,yy,"✓",8,GRN,anchor="middle")
        elif st=='attn': s.circle(RX+7,yy-3,6,AMB_BG,stroke="#e6cfa6"); s.text(RX+7,yy,"!",8,ORG,weight="700",anchor="middle")
        else: s.circle(RX+7,yy-3,6,"#e6f1ef"); s.circle(RX+7,yy-3,2.5,TEAL)
        s.text(RX+22,yy,f"{i+1}. {nm}",10.5,(INK if st!='ok' else "#475569"),weight=("700" if st=='attn' else "400"))
        yy+=27
    yy+=6; s.line(RX,yy,RX+RW,yy,"#e2e8f0"); yy+=20
    s.text(RX,yy,"7 of 9 confirmed",10.5,INK,weight="700"); s.text(RX,yy+16,"2 need your review",9.5,ORG)
    s.rect(RX,yy+26,RW,7,3,"#e6ebf3"); s.rect(RX,yy+26,RW*7/9,7,3,GRN)
    s.text(RX,yy+58,"Adjustment · automatic",9.5,MUTE,weight="600")
    s.text(RX,yy+72,"5th-Year RCS · Section 5b(2)(b)",8.5,MUTE); s.text(RX,yy+84,"submission date: today",8.5,MUTE)

    # ---- center review column ----
    X=408; CW=856; y=130
    # attention strip
    s.rect(X,y,CW,50,10,"#fffaf2",stroke="#e6cfa6",filt="cs")
    s.text(X+18,y+21,"⚠  2 things need your attention",12,ORG,weight="700")
    s.text(X+18,y+38,"Everything else is confirmed from the record and collapsed below.",9.5,"#8a6a3a")
    for i,(lbl,) in enumerate([("UA mismatch → Rents & unit mix",),("CA address overridden → Contract admin",)]):
        bw=W(lbl,9,True)+22; bx=X+CW-18-bw-(0 if i==0 else 0)
    # place two chips right-aligned stacked-inline
    c1="UA mismatch → Rents"; c2="CA address overridden"
    w2=W(c2,9,True)+24; w1=W(c1,9,True)+24
    s.rect(X+CW-18-w2,y+13,w2,22,11,"#ffffff",stroke="#e6cfa6"); s.text(X+CW-18-w2/2,y+28,c2,9,ORG,weight="600",anchor="middle")
    s.rect(X+CW-18-w2-8-w1,y+13,w1,22,11,"#ffffff",stroke="#e6cfa6"); s.text(X+CW-18-w2-8-w1/2,y+28,c1,9,ORG,weight="600",anchor="middle")
    y+=50+18

    # 1 Source documents (expanded)
    y+=exhead(s,X,y,CW,1,"Source documents",'cyc')
    def upl(yy,ok_name,sub,flag=None):
        s.rect(X,yy,CW,46,8,"#f8fafc",stroke=CARD)
        s.circle(X+22,yy+23,10,"#e7f5e9"); s.text(X+22,yy+27,"✓",10,GRN,anchor="middle")
        s.text(X+42,yy+20,ok_name,11.5,INK,weight="700"); s.text(X+42+W(ok_name,11.5,True)+10,yy+20,"parsed",9.5,GRN,weight="600")
        s.text(X+42,yy+35,sub,9.5,SUB)
        if flag: s.text(X+CW-16,yy+27,flag,9,ORG,weight="600",anchor="end")
    upl(y,"RCS report.pdf","→ proposed rents · appraiser · SAFMR · UA (backup)","⚠ UA differs")
    upl(y+56,"2025 executed rent schedule — 92458.pdf","→ current rents · UA · unit mix · Part B · Part D")
    s.text(X,y+120,"AI parsed only the fields the package needs · re-upload either file to refresh.",9,MUTE,italic=True)
    y+=138

    # 2 Property (collapsed)
    y+=collapsed(s,X,y,CW,2,"Property","Gates Manor Apartments · IL06H121063 · 1135 Wilmette Ave, Wilmette IL · Limited Partnership")+14
    # 3 Owner & signatory (collapsed)
    y+=collapsed(s,X,y,CW,3,"Owner & signatory","Claire Beatty (POC) · David Pearson, Vice President · General Partner: Related (GP)")+14

    # 4 Contract admin (expanded, override)
    y+=exhead(s,X,y,CW,4,"Contract administrator",'attn')
    hw=(CW-40)/2
    fld(s,X+12,y+14,hw,"Contact","Ms. Heather Gross","db"); fld(s,X+28+hw,y+14,hw,"Position","Asset Manager","db")
    fld(s,X+12,y+58,hw,"CA organization","National Housing Compliance","db"); fld(s,X+28+hw,y+58,hw,"Salutation (auto)","Dear Ms. Gross","calc")
    fld(s,X+12,y+108,hw,"CA address","1975 Lakeside Pkwy, Ste 310","ov",attn=True,note="you changed this from the stored record"); fld(s,X+28+hw,y+108,hw,"City / State / Zip","Tucker, GA 30084-5860","db")
    y+=168

    # 5 Appraiser (collapsed)
    y+=collapsed(s,X,y,CW,5,"Appraiser","Aaron M. Zabel · Belfry Valuation · azabel@belfryvaluation.com · (708) 500-2380",tag="this cycle",tagc=TEAL)+14

    # 6 Rents & unit mix (expanded, UA mismatch)
    y+=exhead(s,X,y,CW,6,"Rents & unit mix",'attn')
    cols=[("Unit type",X+12,150),("Units",X+186,70),("Current",X+280,110),("Proposed",X+404,110),("Utility allowance",X+540,300)]
    for nm,cx,cw in cols: s.text(cx,y+12,nm,9.5,MUTE)
    row=y+22
    for cx,cw,val,strong in [(X+12,150,"1BR / 1BA",False),(X+186,70,"51",False),(X+280,110,"$1,903",False),(X+404,110,"$2,725",True)]:
        s.rect(cx,row,cw-14,30,5,("#edf6f4" if strong else "#f8fafc"),stroke=CARD); s.text(cx+10,row+20,val,11,(TEAL if strong else "#334155"),weight=("700" if strong else "400"))
    # UA conflict cell
    s.rect(X+540,row,304,30,5,AMB_BG,stroke="#e6cfa6")
    s.text(X+550,row+20,"exec RS $33   vs   RCS $31",10.5,ORG,weight="700"); s.text(X+540+304-10,row+20,"using exec RS ▾",9,ORG,anchor="end")
    s.text(X+12,row+52,"+ Add unit type",10.5,PUR,weight="600")
    s.text(X+CW-12,row+52,"gross rent $2,758 · increase +43% · non-revenue units → Part D",9,MUTE,italic=True,anchor="end")
    y+=row+70-y

    # 7 Items in rent Part B (collapsed)
    y+=collapsed(s,X,y,CW,7,"Items in rent (Part B)","Verbatim from executed schedule — Range · Refrigerator · Carpet + write-in: Microwave · Heating/Hot Water (gas)")+14
    # 8 Checklist (collapsed)
    y+=collapsed(s,X,y,CW,8,"Owner's checklist","15 of 17 selected · license copy N/A (no temporary license) · Appendix 9-2-2")+14
    # 9 Tenant notice (collapsed)
    y+=collapsed(s,X,y,CW,9,"Tenant notice","Tasha Francellno-Glenn, Community Manager · Copy to CA derived from record")+14

    # closing action
    s.line(X,y+2,X+CW,y+2,"#e2e8f0")
    s.text(X,y+26,"When the two flags are resolved, everything is confirmed —",10.5,SUB); 
    s.rect(X+CW-320,y+12,150,30,7,"#ffffff",stroke="#c7d0dc"); s.text(X+CW-320+75,y+32,"Update database",11,"#475569",anchor="middle")
    s.rect(X+CW-160,y+12,160,30,7,NAVY); s.text(X+CW-80,y+32,"Generate package",12,"#fff",weight="700",anchor="middle")

    open("guided.svg","w",encoding="utf-8").write(s.out()); print("guided end y",y+50,"H",H)
build()
