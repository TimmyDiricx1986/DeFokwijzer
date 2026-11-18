"""Deuntje De Fokwijzer (zelf gemaakt met code): zachte vilt-piano, motief G-D-B-G (\"De Fok-wij-zer\"), zachte draf, subtiele paardenbrrr aan begin en einde."""
import numpy as np, sys
from scipy.io import wavfile
from scipy.signal import butter, lfilter
SR=44100; rng=np.random.default_rng(7)
def hz(n): return 440*2**((n-69)/12)
N={'G2':43,'D3':50,'E2':40,'C3':48,'D2':38,'G3':55,'B3':59,'D4':62,'E4':64,'G4':67,'A4':69,'B4':71,'C5':72,'D5':74,'E5':76,'G5':79,'C4':60,'E3':52,'A3':57,'F#4':66,'F#3':54}
def pluck(f,dur,amp=.5,bright=.5):
    n=int(SR*dur); p=max(2,int(SR/f)); buf=rng.uniform(-1,1,p)
    b,a=butter(1,min(.99,bright*4000/(SR/2))); buf=lfilter(b,a,buf)
    out=np.zeros(n); dec=.996
    for i in range(n):
        out[i]=buf[i%p]; buf[i%p]=dec*.5*(buf[i%p]+buf[(i+1)%p])
    env=np.minimum(1,np.linspace(0,dur*400,n)); return amp*out*env
def felt(f,dur,amp=.5,bright=.5):  # zachte vilt-piano: ronde toon, zachte aanslag
    n=int(SR*dur); t=np.arange(n)/SR
    x=np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*2*f*t)*np.exp(-t*4)+.05*np.sin(2*np.pi*3*f*t)*np.exp(-t*7)
    env=np.minimum(1,t/.018)*np.exp(-t*(1.4+f/900))
    return .6*amp*x*env
def pad(fs,dur,amp=.05):  # warme achtergrondklank, traag in en uit
    n=int(SR*dur); t=np.arange(n)/SR; x=np.zeros(n)
    for f in fs:
        for d in (-.12,.12): x+=np.sin(2*np.pi*(f+d)*t)+.12*np.sin(2*np.pi*2*(f+d)*t)
    env=np.minimum(1,t/.6)*np.minimum(1,(dur-t)/.6)
    return amp*x/len(fs)*env
def bell(f,dur,amp=.25):
    t=np.arange(int(SR*dur))/SR; e=np.exp(-t*3.5)
    return amp*e*(np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*2*f*t)+.12*np.sin(2*np.pi*3.01*f*t))*np.minimum(1,t*200)
def bass(f,dur,amp=.35):
    t=np.arange(int(SR*dur))/SR; e=np.exp(-t*2.2)*np.minimum(1,t*80)
    return amp*e*(np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*2*f*t))
def hoof(amp=.5,pitch=1.0):  # houten klik, als een hoef op kasseien
    t=np.arange(int(SR*.09))/SR
    body=np.sin(2*np.pi*(900*pitch)*t)*np.exp(-t*90)+.6*np.sin(2*np.pi*(1700*pitch)*t)*np.exp(-t*140)
    noise=rng.uniform(-1,1,len(t))*np.exp(-t*220)*.5
    return amp*(body+noise)
def shaker(amp=.06):
    t=np.arange(int(SR*.06))/SR; n=rng.uniform(-1,1,len(t)); b,a=butter(2,5000/(SR/2),'high')
    return amp*lfilter(b,a,n)*np.exp(-t*60)
def lp(x,fc=2500):
    b,a=butter(2,fc/(SR/2)); return lfilter(b,a,x)
def snort(amp=.12,dur=.7):  # zachte paardenbrrr: adem door de lippen
    n=int(SR*dur); t=np.arange(n)/SR
    no=rng.uniform(-1,1,n); b,a=butter(2,[220/(SR/2),1300/(SR/2)],'band'); no=lfilter(b,a,no)
    rate=28+6*np.sin(2*np.pi*1.3*t); ph=2*np.pi*np.cumsum(rate)/SR
    am=.45+.55*(.5+.5*np.sin(ph))**2
    env=np.minimum(1,t/.06)*np.exp(-t*3.2)
    x=no*am*env; return amp*x/np.max(np.abs(x))
def add(buf,x,t):
    i=int(t*SR); j=min(len(buf),i+len(x)); buf[i:j]+=x[:j-i]
MOTIF=[('G4',0,.18),('D5',.22,.18),('B4',.44,.18),('G5',.66,1.1)]  # "De Fok-wij-zer"
def motif(buf,t0,amp=.3):
    for n,dt,d in MOTIF:
        x=felt(hz(N[n]),d+1.4,amp*1.1); a=int(SR*.025); x[:a]*=np.linspace(0,1,a)
        add(buf,x,t0+dt); pass
def logo():
    L=4.2; b=np.zeros(int(SR*L))
    add(b,snort(.1),0)
    for k,t in enumerate([.55,.71,.97,1.13]): add(b,lp(hoof(.13,.8 if k%2==0 else .92)),t)   # klip-klop klip-klop
    motif(b,1.35); add(b,bass(hz(N['G2']),2.2,.25),2.01)
    for n in ['G3','B3','D4']: add(b,felt(hz(N[n]),2.2,.09),2.01)
    f=int(SR*1.2); b[-f:]*=np.linspace(1,0,f)**1.5
    return b
def bed(L):
    bpm=100; beat=60/bpm; bar=4*beat; b=np.zeros(int(SR*L))
    prog=[('G2',['G3','B3','D4','G4']),('E2',['E3','G3','B3','E4']),('C3',['C4','E4','G4','C5']),('D2',['D3','F#3','A3','D4'])]
    add(b,snort(.09),0.0); motif(b,.6)
    t=1.9; k=0
    while t<L-4.2:
        root,ch=prog[k%4]
        add(b,bass(hz(N[root]),bar,.26),t); add(b,pad([hz(N[c]) for c in ch[:3]],bar+.3,.05),t)
        pat=[0,1,2,3,2,1,2,3]
        for i,pi in enumerate(pat): add(b,felt(hz(N[ch[pi]]),beat*2,.13),t+i*beat/2)
        for i in range(4):   # draf: klip-klop op elke tel
            add(b,lp(hoof(.08,.8),1800),t+i*beat); add(b,lp(hoof(.05,.92),1800),t+i*beat+beat*.28)
        for i in range(8): add(b,shaker(.02 if i%2 else .012),t+i*beat/2)
        t+=bar; k+=1
    # einde: motief opnieuw + slotakkoord
    te=L-3.6; motif(b,te); add(b,bass(hz(N['G2']),3,.22),te+.66)
    for n in ['G3','B3','D4']: add(b,felt(hz(N[n]),2.8,.08),te+.66)
    add(b,snort(.08,.8),L-1.55)
    fade=int(SR*1.5); b[-fade:]*=np.linspace(1,0,fade)**1.5
    fi=int(SR*.5); b[:fi]*=np.linspace(0,1,fi)
    return b
def norm(x,peak=.89):
    # simpele galm
    d=int(SR*.083); y=x.copy()
    for k,g in [(1,.16),(2,.07),(3,.03)]: y[d*k:]+=g*x[:-d*k]
    return (y/np.max(np.abs(y))*peak).astype(np.float32)
def maak(pad, lengte):
    """Deuntje op maat van een video: motief vooraan, motief op het eindbeeld (lengte - 3 s), uitfade."""
    wavfile.write(pad, SR, norm(bed(max(8.0, float(lengte)))))
if __name__ == '__main__':
    # python3 deuntje-synth.py <map>            -> logo (4 s) en 20 s-versie
    # python3 deuntje-synth.py <bestand.wav> 27 -> deuntje van 27 s
    if len(sys.argv) > 2: maak(sys.argv[1], sys.argv[2])
    else:
        out=sys.argv[1]
        wavfile.write(out+'/fokwijzer-deuntje-logo.wav',SR,norm(logo()))
        wavfile.write(out+'/fokwijzer-deuntje-20s.wav',SR,norm(bed(20.5)))
