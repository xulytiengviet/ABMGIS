const CHARS="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq(value){ let x=(Math.abs(value)<<1)+(value<0?1:0), out=""; do { let digit=x&31; x>>>=5; if(x>0) digit|=32; out+=CHARS[digit]; } while(x>0); return out; }
export function buildSourceMap(marks,{file="output.js",source="input.bila",sourceContent=""}={}){
  const rows=[]; for(const mark of marks){ if(!mark.original?.line) continue; const line=mark.generated.line; while(rows.length<=line) rows.push([]); rows[line].push(mark); }
  let prevSource=0, prevOrigLine=0, prevOrigCol=0; const encoded=[];
  for(let line=0; line<rows.length; line++){
    let prevGenCol=0; const segs=[];
    for(const mark of rows[line].sort((a,b)=>a.generated.column-b.generated.column)){
      const src=0, ol=mark.original.line-1, oc=Math.max(0,(mark.original.column||1)-1);
      segs.push(vlq(mark.generated.column-prevGenCol)+vlq(src-prevSource)+vlq(ol-prevOrigLine)+vlq(oc-prevOrigCol));
      prevGenCol=mark.generated.column; prevSource=src; prevOrigLine=ol; prevOrigCol=oc;
    }
    encoded.push(segs.join(","));
  }
  return {version:3,file,sources:[source],sourcesContent:[sourceContent],names:[],mappings:encoded.join(";")};
}
