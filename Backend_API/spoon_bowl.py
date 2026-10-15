"""Estimate a spoon bowl from a COCO spoon instance mask; never use its box as a mask."""
import cv2
import numpy as np


def extract_spoon_bowl(sp_mask):
    """Cut the handle using the supplied PCA + bottleneck algorithm."""
    sp_mask = (np.asarray(sp_mask) > 0).astype(np.uint8) * 255
    if sp_mask.ndim != 2 or sp_mask.size == 0:
        raise ValueError('Spoon mask must be a nonempty 2D image')
    # Padding ensures an object touching the image edge still has a finite distance.
    padded = np.pad(sp_mask, 1)
    dist_transform = cv2.distanceTransform(padded, cv2.DIST_L2, 5)[1:-1, 1:-1]
    _, max_dist, _, max_loc = cv2.minMaxLoc(dist_transform)
    if max_dist <= 0:
        return np.zeros_like(sp_mask), 0.0, (0, 0)
    spoon_width_px = 2.0 * max_dist
    y_indices, x_indices = np.where(sp_mask > 0)
    if len(x_indices) < 50:
        return np.zeros_like(sp_mask), 0.0, max_loc
    pts_xy = np.column_stack((x_indices, y_indices)).astype(np.float32)
    mean, eigenvectors = cv2.PCACompute(pts_xy, mean=None)
    vx, vy = eigenvectors[0]
    cx, cy = mean[0]
    if vx * (cx - max_loc[0]) + vy * (cy - max_loc[1]) < 0:
        vx, vy = -vx, -vy
    t = (x_indices - max_loc[0]) * vx + (y_indices - max_loc[1]) * vy
    best_cut_t = int(1.4 * max_dist)
    min_width = float('inf')
    for t_val in range(int(0.8 * max_dist), int(2.5 * max_dist), 2):
        mask_slice = (t >= t_val - 2) & (t <= t_val + 2)
        if np.any(mask_slice):
            s = -(x_indices[mask_slice] - max_loc[0]) * vy + (y_indices[mask_slice] - max_loc[1]) * vx
            width_at_t = np.ptp(s) if len(s) > 1 else 0
            if 0 < width_at_t < min_width:
                min_width = width_at_t
                best_cut_t = t_val
    bowl_mask = np.zeros_like(sp_mask)
    bowl_mask[y_indices[t <= best_cut_t], x_indices[t <= best_cut_t]] = 255
    _, labels = cv2.connectedComponents(bowl_mask)
    loc_label = labels[max_loc[1], max_loc[0]]
    if loc_label == 0:
        patch = labels[max(0, max_loc[1] - 3):max_loc[1] + 4, max(0, max_loc[0] - 3):max_loc[0] + 4]
        nz = patch[patch > 0]
        if len(nz):
            loc_label = np.bincount(nz).argmax()
    return (labels == loc_label).astype(np.uint8) * 255 if loc_label > 0 else np.zeros_like(sp_mask), spoon_width_px, max_loc


def measure_spoon_bowl(result, image_shape):
    """Return the largest extracted bowl area and its width, in image pixels."""
    if result.masks is None:
        return 0.0, 0.0
    masks = result.masks.data.cpu().numpy()
    if masks.ndim != 3 or len(masks) != len(result.boxes):
        return 0.0, 0.0
    height, width = image_shape[:2]
    best_area, best_width = 0.0, 0.0
    for box, mask in zip(result.boxes, masks):
        if int(box.cls[0]) != 44:
            continue
        # retina_masks=True must produce original-image masks. A padded low-res
        # mask cannot be stretched safely without undoing letterboxing.
        if mask.shape != (height, width):
            continue
        bowl, bowl_width, _ = extract_spoon_bowl(mask)
        area = float(np.count_nonzero(bowl))
        if area >= 50 and area > best_area and bowl_width > 0:
            best_area, best_width = area, float(bowl_width)
    return best_area, best_width
