# -*- coding: utf-8 -*-
from PIL import ImageFont
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; BLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c={}
def _f(sz,b):
    k=(round(sz*2),b)
    if k not in _c: _c[k]=ImageFont.truetype(BLD if b else REG,max(1,round(sz*2)))
    return _c[k]
def W(t,sz,b=False): return _f(sz,b).getlength(t)/2.0
SPEC={'—':'&#8212;','–':'&#8211;','·':'&#183;','✓':'&#10003;','◆':'&#9670;','●':'&#9679;','↺':'&#8635;','↗':'&#8599;','→':'&#8594;','▾':'&#9662;','✦':'&#10022;','⊞':'&#8862;','＋':'+'}
def esc(s):
    s=s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    for k,v in SPEC.items(): s=s.replace(k,v)
    return s
NAVY="#1e3a5f"; INK="#1e293b"; SUB="#64748b"; MUTE="#94a3b8"; CARD="#e6ebf3"; PAGE="#eef1f7"; LINE="#eef1f5"
PUR="#4c51bf"; TEAL="#0f766e"; ORG="#b45309"; GRN="#2f7d3a"
class SVG:
    def __init__(s,w,h,bg=PAGE):
        s.o=[f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Segoe UI\',\'Helvetica Neue\',Helvetica,Arial,sans-serif">',
             '<defs><filter id="cs" x="-4%" y="-4%" width="108%" height="112%"><feDropShadow dx="0" dy="1.5" stdDeviation="3" flood-color="#1e293b" flood-opacity="0.09"/></filter>'
             '<linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16304f"/><stop offset="1" stop-color="#24476f"/></linearGradient></defs>']
        s.rect(0,0,w,h,0,bg)
    def rect(s,x,y,w,h,rx,fill,stroke=None,sw=1,dash=None,op=None,filt=False):
        a=f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if dash:a+=f' stroke-dasharray="{dash}"'
        if op is not None:a+=f' opacity="{op}"'
        if filt:a+=' filter="url(#cs)"'
        s.o.append(a+'/>')
    def line(s,x1,y1,x2,y2,st,sw=1,dash=None):
        a=f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{st}" stroke-width="{sw}"'
        if dash:a+=f' stroke-dasharray="{dash}"'
        s.o.append(a+'/>')
    def circle(s,cx,cy,r,fill,stroke=None,sw=1):
        a=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        s.o.append(a+'/>')
    def path(s,d,fill="none",stroke=None,sw=1,dash=None,lc=None,lj=None):
        a=f'<path d="{d}" fill="{fill}"'
        if stroke:a+=f' stroke="{stroke}" stroke-width="{sw}"'
        if dash:a+=f' stroke-dasharray="{dash}"'
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
    def out(s): s.o.append('</svg>'); return "\n".join(s.o)

def bullet(s,x,y,t,acc=PUR): s.circle(x,y-3,1.6,acc); s.text(x+10,y,t,9,"#334155")
def numc(s,cx,cy,n,color=NAVY): s.circle(cx,cy,9,color); s.text(cx,cy+3.3,str(n),9,"#fff",weight="700",anchor="middle")
def arrowh(s,x,y,color,d=1): s.path(f"M{x-6*d} {y-4} L{x} {y} L{x-6*d} {y+4} Z",fill=color)

def build():
    W,H=1088,620; s=SVG(W,H)
    # header
    s.rect(0,0,W,56,0,"url(#hdr)")
    s.text(24,26,"How the form and database work together",18,"#ffffff",weight="700")
    s.text(24,45,"Renewal Package Builder · HUD Section 8 (RCS) — one property (Gates Manor) shown end to end",10,"#c3d2e6")
    s.text(W-24,32,"drafts only · nothing auto-submitted",9,"#9fb2cc",italic=True,anchor="end")

    LX,LW=24,292; MX,MW=350,320; RX,RW=706,358

    # ---- Property database (left top) ----
    x,y,w,h=LX,76,LW,214
    s.rect(x,y,w,h,10,"#ffffff",stroke=CARD,filt=True); s.rect(x,y,5,h,0,PUR)
    s.text(x+18,y+22,"Property database",13,PUR,weight="700")
    s.text(x+18,y+38,"Persistent record — one per property",8.5,MUTE,italic=True)
    for i,t in enumerate(["Identifiers & entity","Contacts · signatories · sender","Rents & prior schedule","Unit mix — Part A + non-rev (Part D)","Equipment · utilities · services (Part B)","Stored assets — letterhead, prior schedules"]):
        bullet(s,x+20,y+58+i*20,t)
    s.rect(x+18,y+184,150,20,10,"#eef0fb"); s.text(x+28,y+197,"Standalone → Navigator 2.0",9,PUR,weight="600")

    # ---- Source documents (left bottom) ----
    x,y,w,h=LX,302,LW,176
    s.rect(x,y,w,h,10,"#ffffff",stroke=CARD,filt=True); s.rect(x,y,5,h,0,TEAL)
    s.text(x+18,y+22,"Source documents — this cycle",12,TEAL,weight="700")
    s.text(x+18,y+37,"2 uploads · AI parses only the bare minimum",8.5,MUTE,italic=True)
    s.text(x+18,y+58,"RCS report (PDF)",9.5,INK,weight="700")
    s.text(x+18,y+72,"→ proposed rents · appraiser · SAFMR · UA (backup)",8.5,SUB)
    s.text(x+18,y+94,"Prior executed rent schedule — 92458",9.5,INK,weight="700")
    s.text(x+18,y+108,"→ current rents · UA · unit mix · Part B · Part D",8.5,SUB)
    s.text(x+18,y+134,"org key via backend proxy · manual entry supported",8,MUTE,italic=True)
    s.text(x+18,y+147,"mismatches flagged for the manager",8,MUTE,italic=True)

    # ---- The form (center) ----
    x,y,w,h=MX,76,MW,312
    s.rect(x,y,w,h,10,"#ffffff",stroke=CARD,filt=True)
    s.rect(x,y,w,30,10,NAVY); s.rect(x,y+16,w,14,0,NAVY)
    s.text(x+16,y+20,"The form — Renewal Package Builder",12,"#ffffff",weight="700")
    s.text(x+16,y+48,"Fields pre-fill from the database + the two uploads,",9,SUB)
    s.text(x+16,y+61,"then the property manager confirms.",9,SUB)
    def fbox(cy,cap,capcol,val,tint,bar):
        s.text(x+16,cy,cap,8,capcol,weight="700",letter=0.3)
        s.rect(x+16,cy+6,w-32,24,5,tint,stroke=CARD); s.rect(x+16,cy+6,3,24,0,bar)
        s.text(x+26,cy+22,val,9,"#334155")
    fbox(y+78,"FROM DATABASE",PUR,"Gates Manor · Ms. Heather Gross · David Pearson, VP","#f3f3fc",PUR)
    fbox(y+118,"ENTERED THIS CYCLE",TEAL,"Proposed rent $2,725 · submission date","#edf6f4",TEAL)
    fbox(y+158,"OVERRIDDEN",ORG,"CA address edited","#fdf6ec",ORG)
    fbox(y+198,"AUTO-CALCULATED",SUB,"Salutation · gross rent · GPR","#eef2f6",SUB)
    numc(s,x+25,y+250,3,NAVY); s.text(x+40,y+253,"Manager reviews · confirms · overrides any value",8.5,INK,weight="600")
    s.text(x+16,y+274,"each field shows its source · UA: exec RS vs RCS · SAFMR: HUD",8,MUTE,italic=True)

    # ---- Internal check (right top) ----
    x,y,w,h=RX,76,RW,126
    s.rect(x,y,w,h,10,"#fdfaf4",stroke="#e3c9a3",filt=True); s.rect(x,y,5,h,0,ORG)
    s.text(x+18,y+24,"Internal affordability check",12,ORG,weight="700")
    s.text(x+18,y+44,"Gross rents vs the 150% SAFMR ceiling",9,"#334155")
    s.text(x+18,y+58,"(SAFMR from HUD dataset · RCS matches)",8.5,SUB)
    s.rect(x+18,y+70,w-36,26,6,"#e7f5e9"); s.text(x+28,y+87,"Gates Manor:  $140,658  <  $178,245  →  PASS",9.5,GRN,weight="700")
    s.text(x+18,y+114,"RCS analysis workbook — internal only, never submitted",8,MUTE,italic=True)

    # ---- Generate (right bottom) ----
    x,y,w,h=RX,234,RW,182
    s.rect(x,y,w,h,10,"#ffffff",stroke=CARD,filt=True); s.rect(x,y,5,h,0,NAVY)
    s.text(x+18,y+24,"Generate package — review-ready drafts",12,NAVY,weight="700")
    for i,t in enumerate(["Related letterhead cover letter","Owner cover letter (certifications)","Owner's checklist (Appendix 9-2-2)","RCS report","Draft rent schedule (HUD-92458)","Tenant notice"]):
        yy=y+46+i*18; s.text(x+18,yy,str(i+1),9,PUR,weight="700"); s.text(x+32,yy,t,9,"#334155")
    s.text(x+18,y+166,"Drafts for review — nothing is auto-submitted",8,MUTE,italic=True)

    # ---- arrows ----
    # 1 fill from database
    s.text(316+(350-316)/2,168,"Fill from",8,PUR,weight="700",anchor="middle"); s.text(333,178,"database",8,PUR,weight="700",anchor="middle")
    s.line(316,196,344,196,PUR,2); arrowh(s,350,196,PUR); numc(s,333,210,1,PUR)
    # 2 auto-fill AI
    s.text(333,352,"Auto-fill (AI)",8,TEAL,weight="700",anchor="middle")
    s.line(316,368,344,368,TEAL,2); arrowh(s,350,368,TEAL); numc(s,333,382,2,TEAL)
    # 4 confirmed values (form -> internal check)
    s.text(688,120,"confirmed",8,SUB,weight="700",anchor="middle"); s.text(688,130,"values",8,SUB,weight="700",anchor="middle")
    s.line(670,150,700,150,SUB,2); arrowh(s,706,150,SUB); numc(s,688,150,4,NAVY)
    # 5 on PASS -> generate (vertical)
    s.line(760,202,760,228,GRN,2); arrowh(s,760,234,GRN,d=0); 
    s.path("M760 228 L756 222 L764 222 Z",fill=GRN)
    numc(s,760,216,5,GRN); s.text(778,220,"on PASS → generate",8.5,GRN,weight="700")

    # ---- write-back loop (6) ----
    s.line(510,388,510,492,PUR,2,dash="6 5")
    s.line(510,492,16,492,PUR,2,dash="6 5")
    s.line(16,492,16,150,PUR,2,dash="6 5")
    s.line(16,150,20,150,PUR,2); arrowh(s,24,150,PUR)
    numc(s,30,492,6,PUR)
    s.text(548,514,"Update database — confirmed values written back, stamped today → pre-fills next cycle",9,PUR,weight="600",anchor="middle")

    open("flow_v5.svg","w",encoding="utf-8").write(s.out()); print("flow written 1088x620")

build()
