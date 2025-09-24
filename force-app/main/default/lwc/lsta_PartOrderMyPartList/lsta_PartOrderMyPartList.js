import { LightningElement } from 'lwc';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import CART_CHANGED from '@salesforce/messageChannel/lightning__commerce_cartChanged';

import getMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.getMyPartList';
import removePartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removePartList';
import removeAllyPartListItems from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removeAllyPartListItems';
import removeMyPartListItems from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removeMyPartListItems';

const MENU_MODAL_ACTION_CREATE = 'create';
const MENU_MODAL_ACTION_EDIT = 'edit';


// refresh
            // const wishlistIndex = this.wishlistIndexById[this.myPartsListItem.Id];
            // if (wishlistIndex === -1) {
            //     this.showToast(
            //         'Add Part',
            //         `handleAddPartModalSuccess: error on detail.wishlistId : ${detail.wishlistId}`,
            //         'error'
            //     );
            //     return;
            // };
            // this.selectListByIndex(wishlistIndex);

export default class Lsta_PartOrderMyPartList extends LightningElement {

    columns = [
        { label: 'Sales Status', fieldName: 'salesStatus', initialWidth: 140 },
        { label: 'Part No', fieldName: 'partNo', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'oldPartNumber', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'partName', initialWidth: 200 },
        { label: 'Qty', fieldName: 'qty', type: 'number', initialWidth: 105 },
        { label: 'Unit Price', fieldName: 'unitPrice', type: 'currency', initialWidth: 135 },
        { label: 'Billed Amount', fieldName: 'billedAmount', type: 'currency', initialWidth: 150 },
        { label: 'Latest Order Date', fieldName: 'latestOrderDate', type: 'date', initialWidth: 160 },
        { label: 'Latest Order Quantity', fieldName: 'latestOrderQuantity', type: 'number', initialWidth: 185 },
        { label: 'Initial Wishlist Registration Date', fieldName: 'registrationDate', type: 'date', initialWidth: 250 },
        { label: 'Model Name', fieldName: 'modelName', initialWidth: 300 },
        { label: 'Notes', fieldName: 'notes', initialWidth: 110 },
        { label: 'Remark', fieldName: 'remark', initialWidth: 130 }
    ];

    showCreateListModal;
    showEditListModal;
    showAddPartModal;
    showAddToWishlistModal;
    showUploadSection;


    //
    isLoading;
    showMenuModal = false;
    menuModalAction;
    //


    partsList = [];
    targetList = [];
    myPartsListColumns = [];
    partsToAddToMyPartsListColumns = [];

    // 서버에서 listWishlist 를 list로 주기 때문
    wishlistIndexById = {};
    // 전체 데이터
    myPartsList = [];
    // 전체 데이터 중 찜목록 하나
    myPartsListItem = {};
    // Datatable 출력용
    wishlistItemsDataTableRows = [];

    selectedRowIds = [];

    isUploadMyPartListFile = false;
    isCloneMyParts = false;

    partsCloneTableColums = []; // (원문 표기 유지)
    isTypeClone = true;

    draftValues = [];
    draftValueMap = {}; // 필요 시 new Map() 으로 교체 가능

    isShowCompSet = false;
    checkPartNumber = {};
    checkQuantity = 0;

    partsToCart = [];

    isDistributor = false;

    orderTypeOptions = [
        { label: 'Default Delivery', value: 'Default Delivery' }, // 일반주문
        { label: 'StandingOrder Delivery', value: 'StandingOrder Delivery' }, // 정기주문
        { label: 'DirectOrder Delivery', value: 'DirectOrder Delivery' }, // 직송주문
        { label: 'DirectPaymentOrder Delivery', value: 'DirectPaymentOrder Delivery' } // 직납주문
    ];

    selectedOrderType = 'Default Delivery';

    sitePrefix = '';


    get displayNoData() {
        const items = this.myPartsListItem?.WishlistItems;
        return !items || items.length === 0;
    }

    async connectedCallback() {
        await this.queryMyPartList();
    }

    async queryMyPartList() {
        this.isLoading = true;
        try {
            const { result, payload } = await getMyPartList();
            if (result !== 'OK') {
                this.myPartsList = [];
                this.myPartsListItem = {};
                this.showToast('조회 실패', message || '내 파트 리스트 조회에 실패했습니다.', 'error');
                return;
            }
            console.log('queryMyPartList');
            console.log(payload);

            this.myPartsList = Array.isArray(payload.listWishlist) ? payload.listWishlist : [];
            this.pricebookEntryMap = payload.mapPricebookEntry ?? {};

            if (this.myPartsList.length > 0) {

                this.myPartsList.forEach((wishlist, index) => {
                    if (wishlist?.Id) {
                        this.wishlistIndexById[wishlist.Id] = index;
                    }
                });
            const index = this.wishlistIndexById[payload.Id];

                this.selectListByIndex(0);

            } else {
                this.myPartsListItem = {};
            }
        } catch (error) {
            console.error(error);
            this.myPartsList = [];
            this.myPartsListItem = {};
            this.showToast('오류', error.body?.message || error.message || '내 파트 리스트 조회에 실패했습니다.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    formatWishlistItemForDataTable(wishlistItem) {
        if (!wishlistItem) {
            return null;
        }

        const unitPrice = this.pricebookEntryMap?.[wishlistItem.Product2Id]?.UnitPrice ?? 0;
        const vatIncludedUnitPrice = Math.round(unitPrice * 1.1);

        return {
            id: wishlistItem.Id,
            salesStatus: wishlistItem.Product2?.Part__r?.isSalesPart__c ? '' : 'Not for sale',
            partNo: wishlistItem.Product2?.Part__r?.Partnum__c,
            oldPartNumber: wishlistItem.Product2?.Part__r?.OldPartnum__c,
            partName: wishlistItem.Product2?.Part__r?.NameEng__c,
            qty: wishlistItem.Quantity__c,
            unitPrice: unitPrice,
            billedAmount: this.isDistributor
                ? wishlistItem.Quantity__c * unitPrice
                : wishlistItem.Quantity__c * vatIncludedUnitPrice,
            latestOrderDate: wishlistItem.LastOrderedDate__c
                ? this.toFormatDate(wishlistItem.LastOrderedDate__c)
                : '-',
            latestOrderQuantity: wishlistItem.LastQuantity__c ?? 0,
            registrationDate: this.toFormatDate(wishlistItem.CreatedDate),
            modelName: wishlistItem.Product2?.fm_Model_Names__c,
            notes: wishlistItem.Product2?.REF__c,
            remark: wishlistItem.Remark__c
        };
    }
    
    formatWishlistItemsForDataTable() {
        return (this.myPartsListItem.WishlistItems ?? []).map((wishlistItem) =>
            this.formatWishlistItemForDataTable(wishlistItem)
        );
    }

    toFormatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    }

    handleDivClick() {
        const menu = this.template.querySelector('[data-id="wishlistMenu"]');
        if (menu) {
            const triggerButton = menu.shadowRoot.querySelector('button');
            console.log(triggerButton);
            if (triggerButton) {
                console.log('triggerButton exists');
                triggerButton.click();
            }
        }
    }

    handleListSelect(event) {
        const wishlistId = event.detail.value;
        this.selectListByIndex(this.wishlistIndexById[wishlistId]);
    }

    selectListByIndex(wishlistIndex) {
        this.myPartsListItem = this.myPartsList[wishlistIndex];
        this.wishlistItemsDataTableRows = this.formatWishlistItemsForDataTable();
    }

    handleMenuSelect(event) {
        const selected = event.detail.value;
        switch (selected) {
            case 'create':
                this.menuModalAction = MENU_MODAL_ACTION_CREATE;
                this.showMenuModal = true;
                break;
            case 'edit':
                this.menuModalAction = MENU_MODAL_ACTION_EDIT;
                this.showMenuModal = true;
                break;
            case 'clear':
                this.handleClickClearList();
                break;
            case 'delete':
                this.handleClickDeleteList();
                break;
            default:
        }
        console.log('handleMenuSelect');
        console.log(this.myPartsList);
    }

    async handleClickClearList() {
        this.isLoading = true;
        const wishlistId = this.myPartsListItem.Id;

        try {
            const mapData = {
                Id: wishlistId,
            };

            const response = await removeAllyPartListItems({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Clear failed.';
                throw new Error(message);
            }
            delete this.myPartsListItem.WishlistItems;
            this.showToast('Success', 'Wishlist cleared.', 'success');
        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleClickDeleteList() {
        this.isLoading = true;
        const wishlistId = this.myPartsListItem.Id;
        try {
            const mapData = {
                Id: wishlistId,
            };

            const response = await removePartList({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Delete failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Wishlist deleted.', 'success');
            
            const index = this.wishlistIndexById[wishlistId];
            if (index !== undefined) {
                const updatedList = [...this.myPartsList];
                updatedList.splice(index, 1);
                this.myPartsList = updatedList;

                this.wishlistIndexById = {};
                this.myPartsList.forEach((item, idx) => {
                    this.wishlistIndexById[item.Id] = idx;
                });
            }

            // stack?
            this.selectListByIndex(0);

        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleClickAddPart(event) {
        this.showAddPartModal = true;
    }

    handleRowSelection(event) {
        this.selectedRowIds = event.detail.selectedRows.map(row => row.id);
    }

    async handleClickDeletePart(event) {

        if (!this.selectedRowIds || this.selectedRowIds.length === 0) {
            return;
        }

        this.isLoading = true;
        try {
            const mapData = {
                Id: this.selectedRowIds,
            };
            const response = await removeMyPartListItems({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Delete failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Items deleted.', 'success');
            
            if (this.myPartsListItem?.WishlistItems) {
                this.myPartsListItem.WishlistItems = this.myPartsListItem.WishlistItems.filter(
                    item => !this.selectedRowIds.includes(item.Id)
                );
            }
            this.selectedRowIds = [];

            const wishlistIndex = this.wishlistIndexById[this.myPartsListItem.Id];
            if (wishlistIndex === -1) {
                this.showToast(
                    'Add Part',
                    `lsta_PartOrderMyPartList: error finding index. wishlistId : ${detail.wishlistId}`,
                    'error'
                );
                return;
            };
            this.selectListByIndex(wishlistIndex);

        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleClickUploadCsv(event) {
            console.log('handleClickUploadCsv(event');
        // 실제 업로드는 lightning-file-upload를 사용 권장
        // 여기서는 업로드 섹션 열기/모달 오픈 트리거
    }

    handleClickDownloadCsvForm(event) {
        let csvContent = "data:text/csv;charset=utf-8,";
        let csvCols = ['Wishlist Name','Part No','Qty','Remark'];
        csvContent = "\ufeff" + csvCols.join(',') + "\r\n";
        // let encodedUri = encodeURI(csvContent);
        let encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);

        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'Wishlist Upload Form.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    handleClickAddToWishlist(event) {
            console.log('async handleClickAddToWishlist');
        try {
            this.isLoading = true;
            // 위시리스트 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleClickPrint(event) {
            console.log('handleClickPrint(event');
        // 인쇄 전용 레이아웃 팝업 또는 window.print()
    }

    // 서버를 건들고오자
    handleClickAddToCart(event) {
            console.log('async handleClickAddToCart');
        try {
            this.isLoading = true;
            // 장바구니 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleMenuModalClose() {
        this.menuModalAction = null;
        this.showMenuModal = false;
    }

    handleAddPartModalClose() {
        this.showAddPartModal = false;
    }

    handleMenuModalSuccess(event) {
        const data = event.detail;
        if (!data) {
            return;
        }
        const payload = data.payload;

        if (data.action === MENU_MODAL_ACTION_CREATE) {
            this.myPartsList = [...this.myPartsList, payload];

            this.wishlistIndexById[payload.Id] = this.myPartsList.length - 1;
            this.selectListByIndex(this.myPartsList.length - 1);

        } else if (data.action === MENU_MODAL_ACTION_EDIT) {
            const index = this.wishlistIndexById[payload.Id];
            if (index !== undefined) {
                const updatedList = [...this.myPartsList];
                updatedList[index] = { ...this.myPartsList[index], ...payload };
                this.myPartsList = updatedList;

                this.selectListByIndex(index);
            } else {
                console.warn('리스트에서 해당 Id를 찾지 못했습니다:', payload.Id);
            }
        }
    }

    handleAddPartModalSuccess(event) {
        const data = event.detail;
        if (!data) {
            return;
        }
        const { wishlistId, payload } = data;

        const wishlistIndex = this.wishlistIndexById[wishlistId];
        if (wishlistIndex === -1) {
            this.showToast(
                'Add Part',
                `handleAddPartModalSuccess: error on detail.wishlistId : ${detail.wishlistId}`,
                'error'
            );
            return;
        };
        const wishlist = this.myPartsList[wishlistIndex];

        const updateWishlistItems = (payload) => {
            payload.forEach(item => {

                const items = wishlist.WishlistItems || [];
                const itemIndex = items.findIndex(wi => wi.Id === item.Id);

                if (itemIndex !== -1) {
                    items[itemIndex] = {
                        ...items[itemIndex],
                        ...item
                    };
                } else {
                    items.push({ ...item });
                }
                this.myPartsList[wishlistIndex] = {
                    ...this.myPartsList[wishlistIndex],
                    WishlistItems: items,
                    WishlistProductCount: items.length
                };
            });
        };
        updateWishlistItems(payload);
        this.selectListByIndex(wishlistIndex);
    };
    
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant || 'info'
            })
        );
    }
}