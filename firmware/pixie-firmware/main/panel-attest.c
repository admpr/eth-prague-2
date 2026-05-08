
#include "panels.h"

const uint8_t test[] = {
    165, 103, 118, 101, 114, 115, 105, 111, 110, 1, 102, 100, 111, 109, 97, 105, 110, 162, 104, 99, 111, 110, 116, 114, 97, 99, 116, 84, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144, 103, 99, 104, 97, 105, 110, 73, 100, 67, 170, 54, 167, 100, 115, 97, 108, 116, 88, 32, 18, 52, 86, 120, 144, 171, 205, 239, 18, 52, 86, 120, 144, 171, 205, 239, 18, 52, 86, 120, 144, 171, 205, 239, 18, 52, 86, 120, 144, 171, 205, 239, 102, 97, 99, 116, 105, 111, 110, 108, 67, 108, 97, 105, 109, 84, 101, 115, 116, 69, 84, 72, 102, 112, 97, 114, 97, 109, 115, 129, 163, 100, 110, 97, 109, 101, 105, 114, 101, 99, 105, 112, 105, 101, 110, 116, 100, 116, 121, 112, 101, 103, 97, 100, 100, 114, 101, 115, 115, 101, 118, 97, 108, 117, 101, 84, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144, 18, 52, 86, 120, 144
};


#define INFO_DATA(v)        ((InfoClickArg){ .data = (v) })
#define INFO_NULL           ((InfoClickArg){ })


///////////////////////////////
// Utilities

static void clickApprove(void *_state, InfoClickArg clickArg) {
    ffx_popPanel(true);
}

static void clickReject(void *_state, InfoClickArg clickArg) {
    ffx_popPanel(false);
}


///////////////////////////////
//

typedef struct State {
    FfxDataResult attest;
} State;

bool isEqual(const char* a, FfxDataResult *b) {
    size_t offset = 0;
    while (offset < b->length) {
        if (a[offset] == '\0') { return false; }
        if (a[offset] != b->bytes[offset]) { return false; }
        offset++;
    }
    return (a[offset] == '\0');
}

static int initFunc(void *info, void *_state, void *arg) {

    FfxCborCursor *attest = arg;
    ffx_cbor_dump(attest);

    appendDevice(info, "THIS DEVICE");

    // Domain Network
    appendNetwork(info, domain.chainId);

    // Domain Contract
    appendAddress(info, "CONTRACT", domain.contract);

    // Action
    appendEntry(info, "ACTION", action);

    FfxCborIterator iter = ffx_cbor_iterate(values);
    while(ffx_cbor_nextChild(iter)) {
        if (length != 3) {
            // ERROR:
            break;
        }

        FfxDataResult type = ;
        FfxDataResult data = ;

        char title[20] = { 0 };
        {
            FfxDataResult name = ;
            if (name.length > sizeof(title) - 1) {
                name.length = sizeof(title) - 1;
            }
            strcpy(title, name.bytes, name.length);
        }

        if (isEqual("address", type)) {
            if (data.length != 20) {
                // Error:
                break;
            }
            appendAddress(info, title, data);

        } else if (isEqual("decimal0", type)) {
            if (data.length > 32) {
                // Error:
                break;
            }
            appendDecimal(info, title, 0, data);

        } else {
            // ERROR:
            break;
        }
    }

    // Buttons
    appendButton(info, "REJECT", COLOR_CANCEL, clickReject, INFO_NULL);
    appendButton(info, "SIGN & SEND", COLOR_APPROVE, clickApprove, INFO_NULL);

    return 0;
}


bool pushPanelAttest(FfxCborCursor *attest) {
    return pushPanelInfo(initFunc, "ATTEST", sizeof(State), attest);
}
