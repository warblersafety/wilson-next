#import <AppKit/AppKit.h>
#import <PDFKit/PDFKit.h>
int main(int argc, const char **argv) { @autoreleasepool {
 if(argc!=3) return 2;
 NSString *source=@(argv[1]), *destination=@(argv[2]);
 PDFDocument *document=[[PDFDocument alloc] initWithURL:[NSURL fileURLWithPath:source]];
 if(!document) return 3;
 CGContextRef pdf=CGPDFContextCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:destination],NULL,NULL);
 for(NSUInteger i=0;i<document.pageCount;i++) {
  PDFPage *page=[document pageAtIndex:i]; CGRect bounds=[page boundsForBox:kPDFDisplayBoxMediaBox];
  CFDataRef box=CFDataCreate(NULL,(const UInt8 *)&bounds,sizeof(bounds));
  NSDictionary *options=@{(__bridge NSString *)kCGPDFContextMediaBox:(__bridge NSData *)box};
  CGPDFContextBeginPage(pdf,(__bridge CFDictionaryRef)options);
  [page drawWithBox:kPDFDisplayBoxMediaBox toContext:pdf]; CGPDFContextEndPage(pdf); CFRelease(box);
 }
 CGPDFContextClose(pdf); CGContextRelease(pdf);
 } return 0; }
