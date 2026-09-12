#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <PDFKit/PDFKit.h>

int main(void) {
  @autoreleasepool {
    NSString *evidenceDirectory = @"evidence/issue-78";
    NSString *source = [evidenceDirectory stringByAppendingPathComponent:@"issue78-identity-recovery.pdf"];
    NSURL *sourceURL = [NSURL fileURLWithPath:[[[NSFileManager defaultManager] currentDirectoryPath]
      stringByAppendingPathComponent:source]];
    PDFDocument *document = [[PDFDocument alloc] initWithURL:sourceURL];
    if (document == nil) {
      NSLog(@"Could not open %@", source);
      return 1;
    }

    NSArray<NSNumber *> *pageNumbers = @[@1, @2, @3, @4, @7];
    CGFloat scale = 2.0;
    NSMutableArray *captures = [NSMutableArray array];

    for (NSNumber *number in pageNumbers) {
      NSInteger pageNumber = number.integerValue;
      PDFPage *page = [document pageAtIndex:pageNumber - 1];
      if (page == nil) {
        NSLog(@"PDF does not contain page %ld", (long)pageNumber);
        return 1;
      }
      NSRect bounds = [page boundsForBox:kPDFDisplayBoxMediaBox];
      NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc]
        initWithBitmapDataPlanes:NULL
        pixelsWide:(NSInteger)(bounds.size.width * scale)
        pixelsHigh:(NSInteger)(bounds.size.height * scale)
        bitsPerSample:8
        samplesPerPixel:4
        hasAlpha:YES
        isPlanar:NO
        colorSpaceName:NSDeviceRGBColorSpace
        bytesPerRow:0
        bitsPerPixel:0];
      NSGraphicsContext *graphics = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
      [NSGraphicsContext saveGraphicsState];
      [NSGraphicsContext setCurrentContext:graphics];
      CGContextRef context = graphics.CGContext;
      CGContextSetRGBFillColor(context, 1, 1, 1, 1);
      CGContextFillRect(context, CGRectMake(0, 0, bounds.size.width * scale, bounds.size.height * scale));
      CGContextScaleCTM(context, scale, scale);
      [page drawWithBox:kPDFDisplayBoxMediaBox toContext:context];
      [graphics flushGraphics];
      [NSGraphicsContext restoreGraphicsState];

      NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
      NSString *screenshot = [evidenceDirectory stringByAppendingPathComponent:
        [NSString stringWithFormat:@"issue78-identity-recovery-pdf-page-%ld.png", (long)pageNumber]];
      [png writeToFile:screenshot atomically:YES];
      [captures addObject:@{@"page": number, @"screenshot": screenshot, @"rendered": @YES}];
    }

    NSDictionary *result = @{
      @"renderer": @"macOS PDFKit",
      @"scale": @(scale),
      @"source": source,
      @"capturedPages": captures,
      @"manualInspectionRequired": @[
        @"No password prompt, corruption, or displaced form content is visible",
        @"FDA, MedWatch, Form 3500, OMB expiry, and page identity are preserved",
        @"Sections A and B agree with the repaired reviewed patient and event",
        @"Section D contains the repaired suspect-product identity and indication",
        @"Section G agrees with the direct reporter entry",
      ],
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys error:NULL];
    NSString *resultPath = [evidenceDirectory stringByAppendingPathComponent:@"pdf-rendering-result.json"];
    [json writeToFile:resultPath atomically:YES];
  }
  return 0;
}
