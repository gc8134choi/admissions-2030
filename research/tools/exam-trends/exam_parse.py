"""학교알리미 4-가(교과별 교수·학습 및 평가계획) 첨부 파일(hwp·hwpx·pdf)에서 과목별 정기시험·수행평가 반영 비율을 읽는 파서.
사용: research/tools/exam-trends/README.md. 의존: olefile, pymupdf(fitz).
"""
import olefile,zlib,struct,re,zipfile
def hwp_text(path):
    o=olefile.OleFileIO(path)
    hdr=o.openstream('FileHeader').read();comp=hdr[36]&1
    out=[];n=0
    while o.exists(f'BodyText/Section{n}'):
        d=o.openstream(f'BodyText/Section{n}').read()
        if comp:d=zlib.decompress(d,-15)
        i=0
        while i<len(d):
            h=struct.unpack('<I',d[i:i+4])[0];tag=h&0x3ff;size=(h>>20)&0xfff;i+=4
            if size==0xfff:size=struct.unpack('<I',d[i:i+4])[0];i+=4
            if tag==67:
                t=d[i:i+size].decode('utf-16le','ignore')
                out.append(re.sub(r'[\x00-\x08\x0b-\x1f]','',t))
            i+=size
        n+=1
    return '\n'.join(out)
def hwpx_text(path):
    z=zipfile.ZipFile(path);out=[]
    for n in sorted(x for x in z.namelist() if re.match(r'Contents/section\d+\.xml',x)):
        x=z.read(n).decode('utf-8','ignore')
        out+= [re.sub(r'<[^>]+>','',m) for m in re.findall(r'<hp:t>(.*?)</hp:t>',x,flags=re.S)]
    return '\n'.join(out)
def clean(s): return re.sub(r'[^\w가-힣ⅠⅡⅢ·\s]','',s).strip()
def split_subjects(t):
    ms=list(re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*교수[·ㆍ‧･]학습 운영 계획',t))
    res=[]
    for k,m in enumerate(ms):
        end=ms[k+1].start() if k+1<len(ms) else len(t)
        name=re.sub(r'[^\w가-힣ⅠⅡⅢ ]','',re.sub(r'[㐀-鿿⠀-⯿-]','',m.group(1))).strip()
        res.append((name,t[m.start():end]))
    return res
def ratios(sec):
    m=re.search(r'평가의 종류와 반영 ?비율',sec)
    if not m: return None
    b=sec[m.end():m.end()+900]
    r=re.search(r'정기시험\s*\n\s*수행평가\s*\n\s*합계\s*\n\s*반영 ?비율\s*\n\s*(\d+)\s*%\s*\n\s*(\d+)\s*%\s*\n\s*(\d+)\s*%',b)
    if not r: return {'raw':None}
    out={'written':int(r.group(1)),'performance':int(r.group(2))}
    q=re.search(r'논술형 평가\s*\n\s*반영 ?비율\s*\n((?:\s*\d+\s*%\s*\n)+)',b+sec[m.end()+900:m.end()+1800])
    if q:
        vals=[int(x) for x in re.findall(r'(\d+)\s*%',q.group(1))]
        out['essayTotal']=vals[-1] if vals else None
        out['essayParts']=vals
    return out

import os,io,tempfile
def file_text(path):
    ext=path.rsplit('.',1)[-1].lower()
    if ext=='hwp': return hwp_text(path)
    if ext=='hwpx': return hwpx_text(path)
    if ext=='pdf':
        import fitz
        return '\n'.join(p.get_text() for p in fitz.open(path))
    return ''
def subject_blocks(t, fallback=None):
    out=[]
    heads=[(m.start(),re.sub(r'[㐀-鿿⠀-⯿-]','',m.group(1)).strip()) for m in re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*(?:과\s*)?(?:교수[·ㆍ‧･ ]*학습|평가 세부)',t)]
    for m in re.finditer(r'평가의 종류와 ?반영 ?비율|평가 종류 및 반영 ?비율|평가의 종류 및 반영 ?비율',t):
        blk=t[m.end():m.end()+1600]
        r=re.search(r'정기시험\s*\(?\s*(\d+)\s*%?\s*\)?[\s\S]{0,300}?수행평가\s*\(?\s*(\d+)\s*%',blk)
        w=p=None
        if r: w,p=int(r.group(1)),int(r.group(2))
        else:
            r=re.search(r'정기시험\s*\n\s*수행평가\s*\n\s*합계\s*\n\s*반영 ?비율\s*\n\s*(\d+)\s*%\s*\n\s*(\d+)\s*%',blk)
            if r:w,p=int(r.group(1)),int(r.group(2))
        if w is None or w+p!=100: 
            out.append({'subject':None,'written':None,'performance':None,'at':m.start()});continue
        s=None
        c=re.search(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)',blk)
        prev=[h for h in heads if h[0]<m.start()]
        if prev: s=prev[-1][1]
        if c and not s: s=c.group(1).replace('\n','')
        elif c and prev and len(c.group(1))<30: s=c.group(1).replace('\n','')
        out.append({'subject':(s or fallback),'written':w,'performance':p,'at':m.start()})
    return out

AREAS=[('국어',r'국어|독서|문학|화법|언어와 ?매체|작문|매체|고전'),('수학',r'수학|미적분|기하|확률|대수|통계'),('영어',r'영어'),('사회',r'사회|한국사|역사|지리|윤리|정치|경제|법과|세계사|동아시아'),('과학',r'과학|물리|화학|생명|지구|역학|물질|세포')]
def clean_name(s):
    if not s: return None
    s=re.sub(r'[^가-힣A-Za-z0-9ⅠⅡⅢⅣⅤ·ㆍ‧･․\-, ()]','',s)
    s=re.sub(r'^\(\s*(.*?)\s*\)$',r'\1',s.strip())
    s=re.split(r'\d?[12]차|\(\d+점',s)[0]
    s=re.sub(r'\s+',' ',s).strip()
    s=re.sub(r'(?<=[가-힣ⅠⅡ])\d$','',s).strip()
    return s or None
def area_of(name):
    if not name: return None
    for a,p in AREAS:
        if re.search(p,name): return a
    return None
def parse_file(path,fallback=None):
    t=file_text(path);rows=[]
    for b in subject_blocks(t,fallback):
        if b['written'] is None: continue
        n=clean_name(b['subject']);a=area_of(n)
        if a: rows.append({'subject':n,'area':a,'written':b['written'],'performance':b['performance']})
    return rows,len(t)

RATIO=re.compile(r'\(?\s*(\d{1,3})\s*\)?\s*%\s*\(?\s*(\d{1,3})\s*\)?\s*%\s*\(?\s*100\s*\)?\s*%')
INLINE=re.compile(r'정기\s*시험\s*\(\s*(\d{1,3})\s*%?\s*\)[\s\S]{0,200}?수행\s*평가\s*\(\s*(\d{1,3})\s*%?\s*\)')
def hint_from_filename(fn):
    m=re.search(r'[\(（]([^()（）]+)[\)）]\s*[_.\s]*\.?[a-z]*$',fn) or re.search(r'\(([^()]+)\)',fn)
    if not m: m=re.search(r'_([가-힣ⅠⅡⅢ·]+)_?\.[a-z]+$',fn)
    return m.group(1).strip('_ ') if m else None
def extract_file(path, hint=None):
    t=file_text(path)
    heads=[(m.start(),re.sub(r'[㐀-鿿⠀-⯿-]','',m.group(1)).strip()) for m in re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*(?:과\s*)?(?:교수[·ㆍ‧･ ]*학습|평가 세부|정기시험)',t)]
    out=[]
    for m in re.finditer(r'평가의 종류\s*(?:와|및)?\s*반영\s*비율',t):
        blk=t[m.end():m.end()+1500]
        r=RATIO.search(blk[:900]);w=p=None
        if r and int(r.group(1))+int(r.group(2))==100: w,p=int(r.group(1)),int(r.group(2))
        else:
            r=INLINE.search(blk[:900])
            if r and int(r.group(1))+int(r.group(2))==100: w,p=int(r.group(1)),int(r.group(2))
        if w is None: continue
        s=hint
        if not s:
            prev=[h for h in heads if h[0]<m.start()]
            if prev: s=prev[-1][1]
            c=re.search(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)',blk)
            if c: s=c.group(1).replace('\n','')
        eq=re.search(r'논술형 ?평가\s*\n?\s*반영 ?비율\s*\n((?:\s*[-·\d]+\s*%?\s*\n)+)',blk)
        et=None
        if eq:
            vals=[int(x) for x in re.findall(r'(\d+)\s*%',eq.group(1))]
            if len(vals)>=2 and vals[-1]==sum(vals[:-1]): et=vals[-1]
        out.append({'subject':clean_name(s),'written':w,'performance':p,'essayTotal':et})
    return out

def extract_file2(path, hint=None):
    t=file_text(path).replace('％','%')
    cl=lambda x:re.sub(r'[㐀-鿿⠀-⯿-]','',x).strip()
    heads=[]
    heads+=[(m.start(),cl(m.group(1))) for m in re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*(?:과\s*)?(?:교수[·ㆍ‧･ ]*학습|평가 세부|정기시험)',t)]
    heads+=[(m.start(),cl(m.group(1))) for m in re.finditer(r'학년도\s*\d학기\s*\d학년\s*([^\n]{1,25}?)\s*교수[·ㆍ‧･ ]*학습',t)]
    heads+=[(m.start(),cl(m.group(1))) for m in re.finditer(r'\n([^\n]{2,20})\n\(\d[^)\n]*반\)',t)]
    heads+=[(m.start(),cl(m.group(1))) for m in re.finditer(r'학기\s*\(\s*([^()\n]{1,20}?)\s*\)\s*\n',t)]
    heads.sort()
    out=[]
    for m in re.finditer(r'평가의 종류\s*(?:와|및)?\s*반영\s*비율',t):
        blk=t[m.end():m.end()+1500]
        w=p=None
        for rx in (RATIO,INLINE):
            r=rx.search(blk[:900])
            if r and int(r.group(1))+int(r.group(2))==100: w,p=int(r.group(1)),int(r.group(2));break
        if w is None: continue
        s=hint
        if not s:
            near=re.search(r'\n([^\n]{2,20})\n\(\d[^)\n]*반\)',blk[:300]) or re.search(r'학기\s*\(\s*([^()\n]{1,20}?)\s*\)\s*\n',blk[:300])
            if near: s=cl(near.group(1))
        if not s:
            prev=[h for h in heads if h[0]<m.start()]
            if prev: s=prev[-1][1]
            c=re.search(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)',blk)
            if c: s=c.group(1).replace('\n','')
        eq=re.search(r'논술형 ?평가\s*\n?\s*반영 ?비율[^\n]*\n((?:\s*[-·\d]+\s*%?\s*\n)+)',blk)
        et=None
        if eq:
            vals=[int(x) for x in re.findall(r'(\d+)\s*%',eq.group(1))]
            if len(vals)>=2 and vals[-1]==sum(vals[:-1]): et=vals[-1]
        out.append({'subject':clean_name(s),'written':w,'performance':p,'essayTotal':et})
    return out

RATIO2=re.compile(r'정기\s*시험\s*\n\s*수행\s*평가\s*\n(?:\s*합계\s*\n)?\s*반영\s*비율\s*\n\s*\(?\s*(\d{1,3})\s*\)?\s*%\s*\n\s*\(?\s*(\d{1,3})\s*\)?\s*%')
HDR=re.compile(r'2학기\s*(?:(\d)학년\s*)?([^\n]{1,25}?)\s*교수[·ㆍ‧･ ]*학습\s*(?:및\s*)?평가\s*운영\s*계획')
def hint2(fn):
    m=re.search(r'평가(?:계획|운영계획서?)_(.+?)_*\.[a-z]+$',fn)
    if m: return m.group(1).replace('_',' ').strip()
    return hint_from_filename(fn)
def extract_file3(path, hint=None, grade_hint=None):
    t=file_text(path).replace('％','%')
    cl=lambda x:re.sub(r'[㐀-鿿⠀-⯿-]','',x).strip()
    heads=[]
    for m in HDR.finditer(t):
        n=cl(m.group(2))
        n=re.sub(r'(?<=.{2})과$','',n)
        heads.append((m.start(),n,m.group(1),'H'))
    for m in re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*(?:과\s*)?(?:교수[·ㆍ‧･ ]*학습|평가 세부|정기시험)',t):heads.append((m.start(),cl(m.group(1)),None,'O'))
    for m in re.finditer(r'\n([^\n]{2,20})\n\(\d[^)\n]*반\)',t):heads.append((m.start(),cl(m.group(1)),None,'O'))
    for m in re.finditer(r'학기\s*\(\s*([^()\n]{1,20}?)\s*\)\s*\n',t):heads.append((m.start(),cl(m.group(1)),None,'O'))
    heads.sort()
    out=[]
    for m in re.finditer(r'평가의 종류\s*(?:와|및)?\s*반영\s*비율',t):
        blk=t[m.end():m.end()+1500]
        w=p=None
        for rx in (RATIO,RATIO2,INLINE):
            r=rx.search(blk[:900])
            if r and int(r.group(1))+int(r.group(2))==100: w,p=int(r.group(1)),int(r.group(2));break
        if w is None: continue
        s=None;g=grade_hint
        near=re.search(r'\(\s*([^()\n]{1,25}?)\s*\)\s*과\s*정기시험',blk[:300]) or re.search(r'\n([^\n]{2,20})\n\(\d[^)\n]*반\)',blk[:300]) or re.search(r'학기\s*\(\s*([^()\n]{1,20}?)\s*\)\s*\n',blk[:300])
        cm=re.search(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)',blk[:300])
        if cm and not hint: near=None;s=cl(cm.group(1).replace('\n',''))
        if near: s=cl(near.group(1))
        prev=[h for h in heads if h[0]<m.start()]
        ph=[h for h in prev if h[3]=='H' and h[1] and not re.fullmatch(r'\W*',h[1])]
        if ph and not near: prev=ph
        if not s and prev: s=prev[-1][1]
        if not s and hint: s=hint
        if not s:
            c=re.search(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)',blk)
            if c: s=c.group(1).replace('\n','')
        if prev and prev[-1][2]: g=int(prev[-1][2])
        if g is None:
            gm=re.search(r'평가 대상\s*\n\s*([123])학년',blk[:400]) or re.search(r'\n([123])학년\n해당학급',blk[:200])
            if gm: g=int(gm.group(1))
        if g is None and prev:
            gm=re.search(r'\n\s*([123])\s*학년\s*\n',t[prev[-1][0]:prev[-1][0]+400])
            if gm: g=int(gm.group(1))
        eq=re.search(r'논술형 ?평가\s*\n?\s*반영 ?비율[^\n]*\n((?:\s*[-·\d]+\s*%?\s*\n)+)',blk)
        et=None
        if eq:
            vals=[int(x) for x in re.findall(r'(\d+)\s*%',eq.group(1))]
            if len(vals)>=2 and vals[-1]==sum(vals[:-1]): et=vals[-1]
        out.append({'subject':clean_name(s),'grade':g,'written':w,'performance':p,'essayTotal':et})
    return out

def norm(s): return re.sub(r'[()\s·ㆍ‧･․,]','',(s or '')).replace('II','Ⅱ').replace('I','Ⅰ').replace('1','Ⅰ') if False else re.sub(r'[()\s·ㆍ‧･․,]','',(s or '')).replace('II','Ⅱ').replace('I','Ⅰ')
_old_area=area_of
def area_of2(name):
    if not name: return None
    if re.search(r'영어|영미|English',name): return '영어'
    return _old_area(name)
T1=re.compile(r'합계\s*\n\s*([^\n]{2,25}?)\s*\n\s*\(?\s*\n?\s*\d[\d~,\s\-∼]*반\)?')
T2=re.compile(r'교과\s*\n\s*([^\n]{1,25}(?:\n[^\n]{1,12})?)')
def extract_strict(path, hint=None):
    t=file_text(path).replace('％','%')
    cl=lambda x:re.sub(r'[㐀-鿿⠀-⯿-]','',x).strip()
    heads=[]
    for m in re.finditer(r'학교명\s*\n\s*학년\s*\n\s*과목[\s\S]{0,60}?\n\s*(?:(\d)학년|\d)\s*\n\s*([^\n]+)\n\s*2(?:학기)?\s*\n',t):
        heads.append((m.start(),cl(m.group(2)),1,m.group(1)))
    for m in HDR.finditer(t):
        n=cl(m.group(2));n=re.sub(r'(?<=.{2})과$','',n);heads.append((m.start(),n,1,m.group(1)))
    for m in re.finditer(r'\(\s*([^()\n]{1,25}?)\s*\)\s*(?:과\s*)?(?:교수[·ㆍ‧･ ]*학습|평가 세부|정기시험)',t):heads.append((m.start(),cl(m.group(1)),2,None))
    heads.sort()
    out=[]
    for m in re.finditer(r'평가의 종류\s*(?:와|및)?\s*반영\s*비율',t):
        blk=t[m.end():m.end()+1500]
        w=p=None
        for rx in (RATIO,RATIO2,INLINE):
            r=rx.search(blk[:900])
            if r and int(r.group(1))+int(r.group(2))==100: w,p=int(r.group(1)),int(r.group(2));break
        if w is None: continue
        tn=None
        a=T1.search(blk[:400])
        if a: tn=cl(a.group(1))
        if not tn:
            b=re.search(r'\n([^\n]{2,20})\n\(\d[^)\n]*반\)',blk[:300]) or re.search(r'학기\s*\(\s*([^()\n]{1,20}?)\s*\)\s*\n',blk[:300]) or re.search(r'\(\s*([^()\n]{1,25}?)\s*\)\s*과\s*정기시험',blk[:300])
            if b: tn=cl(b.group(1))
        if not tn:
            c=T2.search(blk[:300])
            if c: tn=cl(c.group(1).replace('\n',''))
        prev=[h for h in heads if h[0]<m.start() and h[1] and len(h[1])>=2 and not re.fullmatch(r'[\d\W]+',h[1])]
        p1=[h for h in prev if h[2]==1]
        hn=(p1[-1][1] if p1 else (prev[-1][1] if prev else None))
        hpos=(p1[-1][0] if p1 else (prev[-1][0] if prev else None))
        name=clean_name(tn) if tn else (clean_name(hn) if hn else (clean_name(hint) if hint else None))
        gr=None
        gm=re.search(r'평가 대상\s*\n\s*([123])학년',blk[:300]) or re.search(r'\n([123])학년\s*\n해당학급',blk[:200])
        if gm: gr=int(gm.group(1))
        elif p1 and len(p1[-1])>3 and p1[-1][3]: gr=int(p1[-1][3])
        out.append({'subject':name,'headerName':clean_name(hn),'tableName':clean_name(tn) if tn else None,'written':w,'performance':p,'grade':gr,'fileHeaders':[h[1] for h in heads if h[2]==1],'hpos':hpos})

    from collections import Counter
    cnt=Counter(o['hpos'] for o in out if not o['tableName'] and o['hpos'] is not None)
    for o in out: o['shared']=bool(not o['tableName'] and cnt.get(o['hpos'],0)>1)
    return out
