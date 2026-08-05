#!/bin/bash
awk '
/const newVal = !dataSaverMode;/ {
    # It matched inside the button. The button started a few lines above.
    # Actually, let us just use sed to delete lines 20565 to 20589.
}
'
