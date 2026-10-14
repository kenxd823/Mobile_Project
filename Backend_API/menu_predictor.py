"""Keep alternative labels from the detector instead of discarding them in NMS."""
from ultralytics.models.yolo.detect.predict import DetectionPredictor
from ultralytics.utils import nms, ops


class MenuPredictor(DetectionPredictor):
    def postprocess(self, preds, img, orig_imgs, **kwargs):
        # Older YOLO checkpoints also return feature maps alongside predictions.
        if isinstance(preds, (tuple, list)):
            preds = preds[0]
        boxes = nms.non_max_suppression(
            preds, self.args.conf, self.args.iou, self.args.classes,
            self.args.agnostic_nms, multi_label=True, max_det=self.args.max_det,
            nc=len(self.model.names), end2end=getattr(self.model, 'end2end', False),
        )
        if not isinstance(orig_imgs, list):
            orig_imgs = ops.convert_torch2numpy_batch(orig_imgs)[..., ::-1]
        return self.construct_results(boxes, img, orig_imgs, **kwargs)
