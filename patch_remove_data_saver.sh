#!/bin/bash
awk '
/onClick=\{\(\) => \{/ {
    if (in_data_saver == 0 && getline_match == 1) {
        # checking if it is data saver
    }
}
'
